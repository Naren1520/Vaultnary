use std::collections::{HashMap, HashSet};

use axum::{
    extract::State,
    http::{header, HeaderValue},
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, QueryBuilder};
use uuid::Uuid;

use crate::{error::ApiError, middleware::auth::AuthUser, state::AppState};
use security::password_hashing::verify_password;
use shared::AppError;

const DELETE_CONFIRMATION: &str = "DELETE";
const MAX_WORKSPACE_TRANSFERS: usize = 5_000;
const MAX_ITEM_TRANSFERS: usize = 5_000;
const RSA_4096_ENVELOPE_BYTES: usize = 512;

#[derive(Serialize)]
struct DeletionPreview {
    data: DeletionPreviewData,
}

#[derive(Serialize)]
struct DeletionPreviewData {
    email: String,
    deletion_scope: DeletionScope,
    workspaces: Vec<WorkspacePreview>,
    owned_credentials: Vec<CredentialPreview>,
}

#[derive(Serialize)]
struct DeletionScope {
    workspace_count: usize,
    personal_credentials_to_delete: usize,
    shared_credentials_to_transfer: usize,
    shared_credentials_you_access: i64,
    projects_to_remove_or_transfer: i64,
    services_to_remove_or_transfer: i64,
    collaborators_to_notify: usize,
}

#[derive(Serialize)]
struct WorkspacePreview {
    id: Uuid,
    name: String,
    role: String,
    owned_by_you: bool,
    remaining_members: i64,
    remaining_admins: i64,
    shared_credentials: i64,
    will_be_preserved: bool,
    requires_owner_transfer: bool,
    transfer_candidates: Vec<TransferCandidate>,
}

#[derive(Serialize)]
struct CredentialPreview {
    id: Uuid,
    name: String,
    workspace_id: Uuid,
    shared_with: i64,
    will_be_deleted: bool,
    requires_transfer: bool,
    transfer_candidates: Vec<TransferCandidate>,
}

#[derive(Clone, Serialize)]
struct TransferCandidate {
    user_id: Uuid,
    email: String,
    role: String,
    is_workspace_member: bool,
    has_public_key: bool,
    public_key_fingerprint: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeleteAccountRequest {
    current_password: String,
    confirmation: String,
    #[serde(default)]
    workspace_transfers: Vec<WorkspaceTransfer>,
    #[serde(default)]
    item_transfers: Vec<ItemTransfer>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkspaceTransfer {
    workspace_id: Uuid,
    recipient_id: Uuid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ItemTransfer {
    item_id: Uuid,
    recipient_id: Uuid,
    recipient_key_fingerprint: String,
    encrypted_dek: String,
}

struct WorkspaceState {
    id: Uuid,
    owner_id: Uuid,
    remaining_members: i64,
    remaining_admins: i64,
    shared_credentials: i64,
}

struct OwnedCredentialState {
    id: Uuid,
    workspace_id: Uuid,
    shared_with: i64,
}

/// GET /api/v1/users/me/deletion-preview
pub async fn preview(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    let email: Option<(String,)> = sqlx::query_as("SELECT email FROM users WHERE id = $1")
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(internal)?;
    let (email,) = email.ok_or_else(|| ApiError::new(AppError::Unauthorized))?;

    let workspace_rows: Vec<(Uuid, String, Uuid, String, i64, i64, i64)> = sqlx::query_as(
        "SELECT w.id, w.name, w.owner_id, current_member.role,
                COUNT(DISTINCT member.user_id) FILTER (WHERE member.user_id <> $1),
                COUNT(DISTINCT member.user_id) FILTER (WHERE member.user_id <> $1 AND member.role IN ('owner', 'admin')),
                COUNT(DISTINCT shared_item.id)
         FROM workspace_members current_member
         JOIN workspaces w ON w.id = current_member.workspace_id
         LEFT JOIN workspace_members member ON member.workspace_id = w.id
         LEFT JOIN (
             SELECT vi.id, v.workspace_id
             FROM vault_items vi
             JOIN vaults v ON v.id = vi.vault_id
             JOIN credential_permissions cp ON cp.item_id = vi.id
             GROUP BY vi.id, v.workspace_id
             HAVING COUNT(DISTINCT cp.user_id) > 1
         ) shared_item ON shared_item.workspace_id = w.id
         WHERE current_member.user_id = $1
         GROUP BY w.id, w.name, w.owner_id, current_member.role
         ORDER BY w.name, w.id",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(internal)?;

    let credential_rows: Vec<(Uuid, String, Uuid, i64)> = sqlx::query_as(
        "SELECT vi.id, vi.name, v.workspace_id,
                COUNT(DISTINCT other_permission.user_id)
         FROM credential_permissions owner_permission
         JOIN vault_items vi ON vi.id = owner_permission.item_id
         JOIN vaults v ON v.id = vi.vault_id
         LEFT JOIN credential_permissions other_permission
           ON other_permission.item_id = vi.id
          AND other_permission.user_id <> $1
         WHERE owner_permission.user_id = $1
           AND owner_permission.role = 'owner'
         GROUP BY vi.id, vi.name, v.workspace_id
         ORDER BY vi.name, vi.id",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(internal)?;

    let transfer_workspace_ids = workspace_rows
        .iter()
        .filter(|workspace| workspace.2 == auth.user_id && (workspace.4 > 0 || workspace.6 > 0))
        .map(|workspace| workspace.0)
        .collect::<Vec<_>>();
    let mut workspace_candidate_map =
        workspace_candidates(db, &transfer_workspace_ids, auth.user_id).await?;
    let mut workspaces = Vec::with_capacity(workspace_rows.len());
    for (id, name, owner_id, role, remaining_members, remaining_admins, shared_credentials) in
        workspace_rows
    {
        let owned_by_you = owner_id == auth.user_id;
        let will_be_preserved = remaining_members > 0 || shared_credentials > 0;
        let transfer_candidates = if owned_by_you && will_be_preserved {
            workspace_candidate_map.remove(&id).unwrap_or_default()
        } else {
            Vec::new()
        };
        workspaces.push(WorkspacePreview {
            id,
            name,
            role,
            owned_by_you,
            remaining_members,
            remaining_admins,
            shared_credentials,
            will_be_preserved,
            requires_owner_transfer: owned_by_you && will_be_preserved,
            transfer_candidates,
        });
    }

    let transfer_credential_ids = credential_rows
        .iter()
        .filter(|credential| credential.3 > 0)
        .map(|credential| credential.0)
        .collect::<Vec<_>>();
    let mut credential_candidate_map =
        item_candidates(db, &transfer_credential_ids, auth.user_id).await?;
    let mut owned_credentials = Vec::with_capacity(credential_rows.len());
    for (id, name, workspace_id, shared_with) in credential_rows {
        let transfer_candidates = if shared_with > 0 {
            credential_candidate_map.remove(&id).unwrap_or_default()
        } else {
            Vec::new()
        };
        owned_credentials.push(CredentialPreview {
            id,
            name,
            workspace_id,
            shared_with,
            will_be_deleted: shared_with == 0,
            requires_transfer: shared_with > 0,
            transfer_candidates,
        });
    }

    let projects_to_remove_or_transfer: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE owner_id = $1")
            .bind(auth.user_id)
            .fetch_one(db)
            .await
            .map_err(internal)?;
    let services_to_remove_or_transfer: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE owner_id = $1")
            .bind(auth.user_id)
            .fetch_one(db)
            .await
            .map_err(internal)?;
    let shared_credentials_you_access: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM credential_permissions WHERE user_id = $1 AND role <> 'owner'",
    )
    .bind(auth.user_id)
    .fetch_one(db)
    .await
    .map_err(internal)?;
    let collaborators_to_notify = notification_recipients(db, auth.user_id).await?.len();

    Ok(Json(DeletionPreview {
        data: DeletionPreviewData {
            email,
            deletion_scope: DeletionScope {
                workspace_count: workspaces.len(),
                personal_credentials_to_delete: owned_credentials
                    .iter()
                    .filter(|item| item.will_be_deleted)
                    .count(),
                shared_credentials_to_transfer: owned_credentials
                    .iter()
                    .filter(|item| item.requires_transfer)
                    .count(),
                shared_credentials_you_access,
                projects_to_remove_or_transfer,
                services_to_remove_or_transfer,
                collaborators_to_notify,
            },
            workspaces,
            owned_credentials,
        },
    }))
}

/// DELETE /api/v1/users/me
pub async fn delete_account(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<DeleteAccountRequest>,
) -> Result<impl IntoResponse, ApiError> {
    validate_request(&body)?;
    let db = state.db();
    let mut tx = db.begin().await.map_err(internal)?;

    let user: Option<(String, String)> =
        sqlx::query_as("SELECT email, password_hash FROM users WHERE id = $1 FOR UPDATE")
            .bind(auth.user_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(internal)?;
    let (email, password_hash) = user.ok_or_else(|| ApiError::new(AppError::Unauthorized))?;
    let password_matches =
        verify_password(&password_hash, &body.current_password).map_err(ApiError::new)?;
    if !password_matches {
        return Err(ApiError::new(AppError::Unauthorized));
    }

    let workspace_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT w.id
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1
         ORDER BY w.id
         FOR UPDATE OF w",
    )
    .bind(auth.user_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(internal)?;

    if !workspace_ids.is_empty() {
        sqlx::query(
            "SELECT id
             FROM workspace_members
             WHERE workspace_id = ANY($1)
             ORDER BY workspace_id, user_id
             FOR UPDATE",
        )
        .bind(&workspace_ids)
        .fetch_all(&mut *tx)
        .await
        .map_err(internal)?;
    }

    let workspace_states = load_workspace_states(&mut tx, auth.user_id, &workspace_ids).await?;
    let credential_states = load_owned_credentials(&mut tx, auth.user_id).await?;

    let workspace_picks = unique_workspace_transfers(&body.workspace_transfers)?;
    let item_picks = unique_item_transfers(&body.item_transfers)?;
    validate_workspace_picks(&mut tx, auth.user_id, &workspace_states, &workspace_picks).await?;
    let encrypted_items =
        validate_item_picks(&mut tx, auth.user_id, &credential_states, &item_picks).await?;

    for workspace in &workspace_states {
        if workspace.owner_id != auth.user_id && workspace.remaining_admins == 0 {
            return Err(ApiError::new(AppError::Conflict(
                "A workspace needs at least one remaining owner or admin before this account can be deleted.".into(),
            )));
        }
    }

    let recipients = notification_recipients_tx(&mut tx, auth.user_id).await?;
    let notifications_queued =
        recipients.len() + usize::from(!recipients.contains(&email.to_lowercase()));
    queue_deletion_notifications(&mut tx, &email, recipients.iter()).await?;

    let workspace_transfers: Vec<(Uuid, Uuid)> = workspace_states
        .iter()
        .filter(|workspace| workspace.owner_id == auth.user_id && workspace_is_preserved(workspace))
        .map(|workspace| {
            (
                workspace.id,
                *workspace_picks
                    .get(&workspace.id)
                    .expect("workspace transfer was validated"),
            )
        })
        .collect();
    for chunk in workspace_transfers.chunks(500) {
        let mut members = QueryBuilder::<sqlx::Postgres>::new(
            "INSERT INTO workspace_members (workspace_id, user_id, role) ",
        );
        members.push_values(chunk, |mut row, (workspace_id, recipient_id)| {
            row.push_bind(*workspace_id)
                .push_bind(*recipient_id)
                .push("'owner'");
        });
        members.push(" ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'");
        members.build().execute(&mut *tx).await.map_err(internal)?;

        let mut owners = QueryBuilder::<sqlx::Postgres>::new(
            "UPDATE workspaces w
             SET owner_id = transfers.recipient_id, updated_at = NOW()
             FROM (",
        );
        owners.push_values(chunk, |mut row, (workspace_id, recipient_id)| {
            row.push_bind(*workspace_id).push_bind(*recipient_id);
        });
        owners.push(
            ") AS transfers(workspace_id, recipient_id)
             WHERE w.id = transfers.workspace_id AND w.owner_id = ",
        );
        owners.push_bind(auth.user_id);
        owners.build().execute(&mut *tx).await.map_err(internal)?;

        let mut vaults = QueryBuilder::<sqlx::Postgres>::new(
            "UPDATE vaults v SET owner_id = transfers.recipient_id FROM (",
        );
        vaults.push_values(chunk, |mut row, (workspace_id, recipient_id)| {
            row.push_bind(*workspace_id).push_bind(*recipient_id);
        });
        vaults.push(
            ") AS transfers(workspace_id, recipient_id)
             WHERE v.workspace_id = transfers.workspace_id AND v.owner_id = ",
        );
        vaults.push_bind(auth.user_id);
        vaults.build().execute(&mut *tx).await.map_err(internal)?;
    }

    let preserved_workspace_ids: Vec<Uuid> = workspace_states
        .iter()
        .filter(|workspace| workspace_is_preserved(workspace))
        .map(|workspace| workspace.id)
        .collect();
    if !preserved_workspace_ids.is_empty() {
        sqlx::query(
            "UPDATE projects p
             SET owner_id = w.owner_id
             FROM workspaces w
             WHERE p.workspace_id = w.id
               AND p.workspace_id = ANY($1)
               AND p.owner_id = $2",
        )
        .bind(&preserved_workspace_ids)
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
        sqlx::query(
            "UPDATE services s
             SET owner_id = w.owner_id
             FROM workspaces w
             WHERE s.workspace_id = w.id
               AND s.workspace_id = ANY($1)
               AND s.owner_id = $2",
        )
        .bind(&preserved_workspace_ids)
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
    }

    let credential_transfers: Vec<(Uuid, Uuid, Vec<u8>)> = credential_states
        .iter()
        .filter(|item| item.shared_with > 0)
        .map(|credential| {
            let (recipient_id, encrypted_dek) = encrypted_items
                .get(&credential.id)
                .expect("item transfer was validated");
            (credential.id, *recipient_id, encrypted_dek.clone())
        })
        .collect();
    for chunk in credential_transfers.chunks(500) {
        let mut permissions = QueryBuilder::<sqlx::Postgres>::new(
            "INSERT INTO credential_permissions (id, item_id, user_id, role, created_at) ",
        );
        permissions.push_values(chunk, |mut row, (item_id, recipient_id, _)| {
            row.push_bind(Uuid::new_v4())
                .push_bind(*item_id)
                .push_bind(*recipient_id)
                .push("'owner', NOW()");
        });
        permissions.push(" ON CONFLICT (item_id, user_id) DO UPDATE SET role = 'owner'");
        permissions
            .build()
            .execute(&mut *tx)
            .await
            .map_err(internal)?;

        let mut envelopes = QueryBuilder::<sqlx::Postgres>::new(
            "INSERT INTO credential_key_envelopes (id, item_id, user_id, encrypted_dek, created_at) ",
        );
        envelopes.push_values(chunk, |mut row, (item_id, recipient_id, encrypted_dek)| {
            row.push_bind(Uuid::new_v4())
                .push_bind(*item_id)
                .push_bind(*recipient_id)
                .push_bind(encrypted_dek.as_slice())
                .push("NOW()");
        });
        envelopes.push(
            " ON CONFLICT (item_id, user_id)
              DO UPDATE SET encrypted_dek = EXCLUDED.encrypted_dek",
        );
        envelopes
            .build()
            .execute(&mut *tx)
            .await
            .map_err(internal)?;
    }

    let credentials_to_delete: Vec<Uuid> = credential_states
        .iter()
        .filter(|item| item.shared_with == 0)
        .map(|item| item.id)
        .collect();
    if !credentials_to_delete.is_empty() {
        sqlx::query("DELETE FROM vault_items WHERE id = ANY($1)")
            .bind(&credentials_to_delete)
            .execute(&mut *tx)
            .await
            .map_err(internal)?;
    }

    sqlx::query("SELECT public.purge_account_audit_events($1)")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
    let deleted = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
    if deleted.rows_affected() != 1 {
        return Err(ApiError::new(AppError::Conflict(
            "The account changed during deletion. Please reload and try again.".into(),
        )));
    }

    tx.commit().await.map_err(internal)?;

    let secure = !state.config().is_development();
    let cookie = HeaderValue::from_str(if secure {
        "vault_session=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure"
    } else {
        "vault_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
    })
    .expect("account deletion cookie is valid");
    let response = Json(serde_json::json!({
        "data": {
            "deleted": true,
            "notifications_queued": notifications_queued
        }
    }))
    .into_response();
    let mut response = response;
    response.headers_mut().insert(header::SET_COOKIE, cookie);
    Ok(response)
}

async fn workspace_candidates(
    db: &PgPool,
    workspace_ids: &[Uuid],
    user_id: Uuid,
) -> Result<HashMap<Uuid, Vec<TransferCandidate>>, ApiError> {
    if workspace_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows: Vec<(Uuid, Uuid, String, Option<String>, bool, Option<String>)> = sqlx::query_as(
        "SELECT DISTINCT w.id, u.id, u.email, wm.role,
                    wm.user_id IS NOT NULL,
                    (SELECT pk.fingerprint FROM user_public_keys pk
                     WHERE pk.user_id = u.id ORDER BY pk.created_at DESC LIMIT 1)
             FROM workspaces w
             JOIN workspace_members current_member
               ON current_member.workspace_id = w.id AND current_member.user_id = $2
             JOIN users u ON u.id <> $2 AND u.email_verified = true
             LEFT JOIN workspace_members wm
               ON wm.workspace_id = w.id AND wm.user_id = u.id
             WHERE w.id = ANY($1)
               AND (
                   wm.user_id IS NOT NULL
                   OR EXISTS (
                       SELECT 1
                       FROM vaults v
                       JOIN vault_items vi ON vi.vault_id = v.id
                       JOIN credential_permissions cp ON cp.item_id = vi.id
                       WHERE v.workspace_id = w.id AND cp.user_id = u.id
                   )
               )
             ORDER BY w.id, u.email",
    )
    .bind(workspace_ids)
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(internal)?;
    let mut candidates = HashMap::<Uuid, Vec<TransferCandidate>>::new();
    for (workspace_id, user_id, email, role, is_workspace_member, public_key_fingerprint) in rows {
        candidates
            .entry(workspace_id)
            .or_default()
            .push(TransferCandidate {
                user_id,
                email,
                role: role.unwrap_or_else(|| "credential collaborator".into()),
                is_workspace_member,
                has_public_key: public_key_fingerprint.is_some(),
                public_key_fingerprint,
            });
    }
    Ok(candidates)
}

async fn item_candidates(
    db: &PgPool,
    item_ids: &[Uuid],
    user_id: Uuid,
) -> Result<HashMap<Uuid, Vec<TransferCandidate>>, ApiError> {
    if item_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows: Vec<(Uuid, Uuid, String, Option<String>, bool, Option<String>)> = sqlx::query_as(
        "SELECT DISTINCT item.id, u.id, u.email, cp.role,
                    wm.user_id IS NOT NULL,
                    public_key.fingerprint
             FROM (
                 SELECT vi.id, v.workspace_id
                 FROM credential_permissions owner_permission
                 JOIN vault_items vi ON vi.id = owner_permission.item_id
                 JOIN vaults v ON v.id = vi.vault_id
                 WHERE owner_permission.user_id = $2
                   AND owner_permission.role = 'owner'
                   AND vi.id = ANY($1)
                   AND EXISTS (
                       SELECT 1 FROM credential_permissions other_permission
                       WHERE other_permission.item_id = vi.id
                         AND other_permission.user_id <> $2
                   )
             ) item
             JOIN users u ON u.id <> $2 AND u.email_verified = true
             LEFT JOIN credential_permissions cp
               ON cp.item_id = item.id AND cp.user_id = u.id
             LEFT JOIN workspace_members wm
               ON wm.workspace_id = item.workspace_id AND wm.user_id = u.id
             LEFT JOIN LATERAL (
                 SELECT pk.fingerprint
                 FROM user_public_keys pk
                 WHERE pk.user_id = u.id
                 ORDER BY pk.created_at DESC
                 LIMIT 1
             ) public_key ON true
             WHERE public_key.fingerprint IS NOT NULL
               AND (cp.user_id IS NOT NULL OR wm.user_id IS NOT NULL)
             ORDER BY item.id, u.email",
    )
    .bind(item_ids)
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(internal)?;
    let mut candidates = HashMap::<Uuid, Vec<TransferCandidate>>::new();
    for (item_id, user_id, email, role, is_workspace_member, public_key_fingerprint) in rows {
        candidates
            .entry(item_id)
            .or_default()
            .push(TransferCandidate {
                user_id,
                email,
                role: role.unwrap_or_else(|| "workspace member".into()),
                is_workspace_member,
                has_public_key: true,
                public_key_fingerprint,
            });
    }
    Ok(candidates)
}

async fn load_workspace_states(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    workspace_ids: &[Uuid],
) -> Result<Vec<WorkspaceState>, ApiError> {
    let rows: Vec<(Uuid, Uuid, i64, i64, i64)> = sqlx::query_as(
        "SELECT w.id, w.owner_id,
                COUNT(*) FILTER (WHERE wm.user_id <> $2),
                COUNT(*) FILTER (WHERE wm.user_id <> $2 AND wm.role IN ('owner', 'admin')),
                (
                    SELECT COUNT(*)
                    FROM (
                        SELECT vi.id
                        FROM vaults v
                        JOIN vault_items vi ON vi.vault_id = v.id
                        JOIN credential_permissions cp ON cp.item_id = vi.id
                        WHERE v.workspace_id = w.id
                        GROUP BY vi.id
                        HAVING COUNT(DISTINCT cp.user_id) > 1
                    ) shared_items
                )
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE w.id = ANY($1)
         GROUP BY w.id, w.owner_id
         ORDER BY w.id",
    )
    .bind(workspace_ids)
    .bind(user_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(internal)?;
    Ok(rows
        .into_iter()
        .map(
            |(id, owner_id, remaining_members, remaining_admins, shared_credentials)| {
                WorkspaceState {
                    id,
                    owner_id,
                    remaining_members,
                    remaining_admins,
                    shared_credentials,
                }
            },
        )
        .collect())
}

async fn load_owned_credentials(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
) -> Result<Vec<OwnedCredentialState>, ApiError> {
    let item_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT vi.id
         FROM credential_permissions cp
         JOIN vault_items vi ON vi.id = cp.item_id
         WHERE cp.user_id = $1 AND cp.role = 'owner'
         ORDER BY vi.id
         FOR UPDATE OF vi",
    )
    .bind(user_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(internal)?;
    if !item_ids.is_empty() {
        sqlx::query(
            "SELECT id
             FROM credential_permissions
             WHERE item_id = ANY($1)
             ORDER BY item_id, user_id
             FOR UPDATE",
        )
        .bind(&item_ids)
        .fetch_all(&mut **tx)
        .await
        .map_err(internal)?;
    }
    let rows: Vec<(Uuid, Uuid, i64)> = sqlx::query_as(
        "SELECT vi.id, v.workspace_id, COUNT(other_permission.user_id)
         FROM credential_permissions owner_permission
         JOIN vault_items vi ON vi.id = owner_permission.item_id
         JOIN vaults v ON v.id = vi.vault_id
         LEFT JOIN credential_permissions other_permission
           ON other_permission.item_id = vi.id
          AND other_permission.user_id <> $1
         WHERE owner_permission.user_id = $1
           AND owner_permission.role = 'owner'
         GROUP BY vi.id, v.workspace_id
         ORDER BY vi.id",
    )
    .bind(user_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(internal)?;
    Ok(rows
        .into_iter()
        .map(|(id, workspace_id, shared_with)| OwnedCredentialState {
            id,
            workspace_id,
            shared_with,
        })
        .collect())
}

async fn validate_workspace_picks(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    workspaces: &[WorkspaceState],
    picks: &HashMap<Uuid, Uuid>,
) -> Result<(), ApiError> {
    for (id, _) in picks {
        if !workspaces.iter().any(|workspace| {
            workspace.id == *id
                && workspace.owner_id == user_id
                && workspace_is_preserved(workspace)
        }) {
            return Err(conflict(
                "A workspace transfer is no longer valid. Reload the deletion review.",
            ));
        }
    }
    for workspace in workspaces
        .iter()
        .filter(|workspace| workspace.owner_id == user_id && workspace_is_preserved(workspace))
    {
        let recipient_id = picks.get(&workspace.id).ok_or_else(|| {
            conflict("Choose a new owner for every shared workspace before deleting your account.")
        })?;
        let eligible: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = $1 AND u.email_verified = true AND u.id <> $2
                  AND (
                      EXISTS (SELECT 1 FROM workspace_members wm
                              WHERE wm.workspace_id = $3 AND wm.user_id = u.id)
                      OR EXISTS (
                          SELECT 1
                          FROM vaults v
                          JOIN vault_items vi ON vi.vault_id = v.id
                          JOIN credential_permissions cp ON cp.item_id = vi.id
                          WHERE v.workspace_id = $3 AND cp.user_id = u.id
                      )
                  )
             )",
        )
        .bind(recipient_id)
        .bind(user_id)
        .bind(workspace.id)
        .fetch_one(&mut **tx)
        .await
        .map_err(internal)?;
        if !eligible {
            return Err(conflict("The selected workspace owner is no longer eligible. Reload and choose another member."));
        }
    }
    Ok(())
}

async fn validate_item_picks(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    credentials: &[OwnedCredentialState],
    picks: &HashMap<Uuid, &ItemTransfer>,
) -> Result<HashMap<Uuid, (Uuid, Vec<u8>)>, ApiError> {
    for (id, _) in picks {
        if !credentials
            .iter()
            .any(|item| item.id == *id && item.shared_with > 0)
        {
            return Err(conflict(
                "A credential transfer is no longer valid. Reload the deletion review.",
            ));
        }
    }
    let mut transfers = HashMap::new();
    for credential in credentials.iter().filter(|item| item.shared_with > 0) {
        let pick = picks.get(&credential.id).ok_or_else(|| {
            conflict("Choose a new owner for every shared credential before deleting your account.")
        })?;
        let encrypted_dek = crate::routes::vaults::decode_base64_or_hex(&pick.encrypted_dek)
            .filter(|bytes| bytes.len() == RSA_4096_ENVELOPE_BYTES)
            .ok_or_else(|| {
                ApiError::new(AppError::UnprocessableEntity(
                    "A transferred credential key is invalid. Unlock your vault and try again."
                        .into(),
                ))
            })?;
        let eligible: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = $1 AND u.email_verified = true AND u.id <> $2
                  AND (
                      EXISTS (SELECT 1 FROM credential_permissions cp
                              WHERE cp.item_id = $3 AND cp.user_id = u.id)
                      OR EXISTS (SELECT 1 FROM workspace_members wm
                                 WHERE wm.workspace_id = $4 AND wm.user_id = u.id)
                  )
                  AND EXISTS (
                      SELECT 1 FROM user_public_keys pk
                      WHERE pk.user_id = u.id AND pk.fingerprint = $5
                  )
             )",
        )
        .bind(pick.recipient_id)
        .bind(user_id)
        .bind(credential.id)
        .bind(credential.workspace_id)
        .bind(&pick.recipient_key_fingerprint)
        .fetch_one(&mut **tx)
        .await
        .map_err(internal)?;
        if !eligible {
            return Err(conflict("A selected credential recipient is no longer eligible. Reload and choose another member."));
        }
        transfers.insert(credential.id, (pick.recipient_id, encrypted_dek));
    }
    Ok(transfers)
}

async fn notification_recipients(db: &PgPool, user_id: Uuid) -> Result<HashSet<String>, ApiError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT LOWER(email)
         FROM (
             SELECT u.email
             FROM workspace_members wm
             JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id IN (
                 SELECT workspace_id FROM workspace_members WHERE user_id = $1
             ) AND u.id <> $1
             UNION
             SELECT u.email
             FROM credential_permissions owner_permission
             JOIN credential_permissions collaborator
               ON collaborator.item_id = owner_permission.item_id
              AND collaborator.user_id <> $1
             JOIN users u ON u.id = collaborator.user_id
             WHERE owner_permission.user_id = $1
             UNION
             SELECT invitation.invitee_email
             FROM share_invitations invitation
             JOIN credential_permissions owner_permission
               ON owner_permission.item_id = invitation.item_id
              AND owner_permission.user_id = $1
             WHERE invitation.inviter_id = $1 AND invitation.state = 'pending'
         ) recipients
         WHERE email IS NOT NULL AND email <> ''",
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(internal)?;
    Ok(rows.into_iter().map(|(email,)| email).collect())
}

async fn notification_recipients_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
) -> Result<HashSet<String>, ApiError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT LOWER(email)
         FROM (
             SELECT u.email
             FROM workspace_members wm
             JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id IN (
                 SELECT workspace_id FROM workspace_members WHERE user_id = $1
             ) AND u.id <> $1
             UNION
             SELECT u.email
             FROM credential_permissions owner_permission
             JOIN credential_permissions collaborator
               ON collaborator.item_id = owner_permission.item_id
              AND collaborator.user_id <> $1
             JOIN users u ON u.id = collaborator.user_id
             WHERE owner_permission.user_id = $1
             UNION
             SELECT invitation.invitee_email
             FROM share_invitations invitation
             JOIN credential_permissions owner_permission
               ON owner_permission.item_id = invitation.item_id
              AND owner_permission.user_id = $1
             WHERE invitation.inviter_id = $1 AND invitation.state = 'pending'
         ) recipients
         WHERE email IS NOT NULL AND email <> ''",
    )
    .bind(user_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(internal)?;
    Ok(rows.into_iter().map(|(email,)| email).collect())
}

async fn queue_deletion_notifications<'a>(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    deleting_user_email: &str,
    recipients: impl Iterator<Item = &'a String>,
) -> Result<(), ApiError> {
    let mut addresses: HashSet<String> = recipients.map(|email| email.to_lowercase()).collect();
    addresses.insert(deleting_user_email.to_lowercase());
    let subject = "Vaultnary account deletion and shared access update";
    let html = r#"<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#222">
      <h2>Vaultnary account update</h2>
      <p>A Vaultnary account connected to a workspace or shared credential has been deleted.</p>
      <p>Shared workspaces and credentials with other authorized users were preserved. Ownership and access may have changed. Sign in to Vaultnary to review your current access.</p>
      <p>No passwords, credential values, or secret key material are included in this email.</p>
    </div>"#;
    let addresses: Vec<String> = addresses.into_iter().collect();
    for chunk in addresses.chunks(500) {
        let mut query = QueryBuilder::<sqlx::Postgres>::new(
            "INSERT INTO email_outbox (recipient_email, subject, html_body) ",
        );
        query.push_values(chunk, |mut row, address| {
            row.push_bind(address).push_bind(subject).push_bind(html);
        });
        query.build().execute(&mut **tx).await.map_err(internal)?;
    }
    Ok(())
}

fn validate_request(body: &DeleteAccountRequest) -> Result<(), ApiError> {
    if body.current_password.is_empty() || body.current_password.len() > 128 {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "Enter your current password (up to 128 characters).".into(),
        )));
    }
    if body.confirmation != DELETE_CONFIRMATION {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "Type DELETE exactly to confirm account deletion.".into(),
        )));
    }
    if body.workspace_transfers.len() > MAX_WORKSPACE_TRANSFERS
        || body.item_transfers.len() > MAX_ITEM_TRANSFERS
    {
        return Err(ApiError::new(AppError::PayloadTooLarge));
    }
    if body.item_transfers.iter().any(|transfer| {
        transfer.recipient_key_fingerprint.is_empty()
            || transfer.recipient_key_fingerprint.len() > 256
            || transfer.encrypted_dek.is_empty()
            || transfer.encrypted_dek.len() > 2_048
    }) {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "A credential transfer key or recipient fingerprint is invalid.".into(),
        )));
    }
    Ok(())
}

fn unique_workspace_transfers(
    transfers: &[WorkspaceTransfer],
) -> Result<HashMap<Uuid, Uuid>, ApiError> {
    let mut result = HashMap::with_capacity(transfers.len());
    for transfer in transfers {
        if result
            .insert(transfer.workspace_id, transfer.recipient_id)
            .is_some()
        {
            return Err(conflict(
                "Each workspace can have only one selected new owner.",
            ));
        }
    }
    Ok(result)
}

fn unique_item_transfers<'a>(
    transfers: &'a [ItemTransfer],
) -> Result<HashMap<Uuid, &'a ItemTransfer>, ApiError> {
    let mut result = HashMap::with_capacity(transfers.len());
    for transfer in transfers {
        if result.insert(transfer.item_id, transfer).is_some() {
            return Err(conflict(
                "Each credential can have only one selected new owner.",
            ));
        }
    }
    Ok(result)
}

fn workspace_is_preserved(workspace: &WorkspaceState) -> bool {
    workspace.remaining_members > 0 || workspace.shared_credentials > 0
}

fn conflict(message: &str) -> ApiError {
    ApiError::new(AppError::Conflict(message.into()))
}

fn internal(error: impl Into<anyhow::Error>) -> ApiError {
    ApiError::new(AppError::Internal(error.into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(confirmation: &str) -> DeleteAccountRequest {
        DeleteAccountRequest {
            current_password: "current-password".into(),
            confirmation: confirmation.into(),
            workspace_transfers: Vec::new(),
            item_transfers: Vec::new(),
        }
    }

    #[test]
    fn deletion_requires_exact_confirmation_and_a_current_password() {
        assert!(validate_request(&request("DELETE")).is_ok());
        assert!(validate_request(&request("delete")).is_err());
        let mut no_password = request("DELETE");
        no_password.current_password.clear();
        assert!(validate_request(&no_password).is_err());
    }

    #[test]
    fn workspace_preservation_accounts_for_members_and_shared_credentials() {
        let state = WorkspaceState {
            id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            remaining_members: 0,
            remaining_admins: 0,
            shared_credentials: 0,
        };
        assert!(!workspace_is_preserved(&state));
        assert!(workspace_is_preserved(&WorkspaceState {
            remaining_members: 1,
            ..state
        }));
        assert!(workspace_is_preserved(&WorkspaceState {
            shared_credentials: 1,
            ..state
        }));
    }

    #[test]
    fn duplicate_transfer_targets_are_rejected() {
        let id = Uuid::new_v4();
        let recipient_id = Uuid::new_v4();
        let workspace_transfers = [
            WorkspaceTransfer {
                workspace_id: id,
                recipient_id,
            },
            WorkspaceTransfer {
                workspace_id: id,
                recipient_id,
            },
        ];
        assert!(unique_workspace_transfers(&workspace_transfers).is_err());

        let encrypted_dek = "00".repeat(RSA_4096_ENVELOPE_BYTES);
        let item_transfers = [
            ItemTransfer {
                item_id: id,
                recipient_id,
                recipient_key_fingerprint: "fingerprint".into(),
                encrypted_dek: encrypted_dek.clone(),
            },
            ItemTransfer {
                item_id: id,
                recipient_id,
                recipient_key_fingerprint: "fingerprint".into(),
                encrypted_dek,
            },
        ];
        assert!(unique_item_transfers(&item_transfers).is_err());
    }
}
