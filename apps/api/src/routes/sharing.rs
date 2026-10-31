use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    error::ApiError,
    middleware::auth::AuthUser,
    state::AppState,
};
use shared::AppError;

async fn insert_audit(
    db: &sqlx::PgPool,
    actor_id: Uuid,
    action_type: &str,
    resource_id: Option<Uuid>,
    resource_type: Option<&str>,
    metadata: serde_json::Value,
) {
    let _ = sqlx::query(
        "INSERT INTO audit_events (id, actor_id, action_type, resource_id, resource_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .bind(action_type)
    .bind(resource_id)
    .bind(resource_type)
    .bind(metadata)
    .execute(db)
    .await;
}

/* Check that user has Owner or co_owner role on item */
async fn require_owner_or_coowner(
    db: &sqlx::PgPool,
    item_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    let perm: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match perm {
        None => Err(ApiError::new(AppError::NotFound)),
        Some((role,)) if role != "owner" && role != "co_owner" => {
            Err(ApiError::new(AppError::Forbidden))
        }
        _ => Ok(()),
    }
}

/* POST /api/v1/vault/items/:item_id/invitations */
pub async fn create_invitation(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    require_owner_or_coowner(db, item_id, auth.user_id).await?;

    let invitee_email = body
        .get("invitee_email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if invitee_email.is_empty() {
        return Err(ApiError::new(AppError::UnprocessableEntity("invitee_email is required".into())));
    }

    let role = body.get("role").and_then(|v| v.as_str()).unwrap_or("viewer");
    if !["viewer", "editor", "co_owner"].contains(&role) {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "role must be viewer, editor, or co_owner".into(),
        )));
    }

    let encrypted_dek: Option<&str> = body.get("encrypted_dek").and_then(|v| v.as_str());

    let id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();
    let expires_at = now + time::Duration::days(7);

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "INSERT INTO share_invitations
         (id, item_id, inviter_id, invitee_email, role, state, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)",
    )
    .bind(id)
    .bind(item_id)
    .bind(auth.user_id)
    .bind(&invitee_email)
    .bind(role)
    .bind(expires_at)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Store key envelope for invitee if DEK provided */
    if let Some(dek) = encrypted_dek {
        /* Look up invitee user id */
        let invitee: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM users WHERE email = $1",
        )
        .bind(&invitee_email)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        if let Some((invitee_id,)) = invitee {
            sqlx::query(
                "INSERT INTO credential_key_envelopes (id, item_id, user_id, encrypted_dek, created_at)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (item_id, user_id) DO UPDATE SET encrypted_dek = EXCLUDED.encrypted_dek",
            )
            .bind(Uuid::new_v4())
            .bind(item_id)
            .bind(invitee_id)
            .bind(dek)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        }
    }

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "invitation.created",
        Some(id),
        Some("share_invitation"),
        serde_json::json!({ "item_id": item_id, "invitee_email": invitee_email, "role": role }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "data": { "id": id } }))).into_response())
}

/* GET /api/v1/vault/items/:item_id/invitations */
pub async fn list_invitations(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    require_owner_or_coowner(db, item_id, auth.user_id).await?;

    type InvRow = (Uuid, String, String, String, OffsetDateTime, OffsetDateTime);
    let rows: Vec<InvRow> = sqlx::query_as(
        "SELECT id, invitee_email, role, state, expires_at, created_at
         FROM share_invitations WHERE item_id = $1 ORDER BY created_at DESC",
    )
    .bind(item_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct InvItem {
        id: Uuid,
        invitee_email: String,
        role: String,
        state: String,
        expires_at: String,
        created_at: String,
    }
    let items: Vec<InvItem> = rows.into_iter().map(|(id, email, role, state, exp, ca)| InvItem {
        id, invitee_email: email, role, state, expires_at: exp.to_string(), created_at: ca.to_string(),
    }).collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

/* POST /api/v1/invitations/:invitation_id/accept */
pub async fn accept_invitation(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(invitation_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Look up user email */
    let user_email: Option<(String,)> = sqlx::query_as("SELECT email FROM users WHERE id = $1")
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let (user_email,) = user_email.ok_or_else(|| ApiError::new(AppError::Unauthorized))?;

    type InvRow = (Uuid, String, String, OffsetDateTime);
    let inv: Option<InvRow> = sqlx::query_as(
        "SELECT item_id, role, state, expires_at FROM share_invitations
         WHERE id = $1 AND invitee_email = $2",
    )
    .bind(invitation_id)
    .bind(&user_email)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (item_id, role, state, expires_at) =
        inv.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    if state != "pending" {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "invitation is not in pending state".into(),
        )));
    }
    if expires_at < OffsetDateTime::now_utc() {
        return Err(ApiError::new(AppError::UnprocessableEntity("invitation has expired".into())));
    }

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "UPDATE share_invitations SET state = 'accepted', updated_at = NOW() WHERE id = $1",
    )
    .bind(invitation_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Grant permission -upsert to handle race */
    sqlx::query(
        "INSERT INTO credential_permissions (id, item_id, user_id, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (item_id, user_id) DO UPDATE SET role = EXCLUDED.role",
    )
    .bind(Uuid::new_v4())
    .bind(item_id)
    .bind(auth.user_id)
    .bind(&role)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "invitation.accepted",
        Some(invitation_id),
        Some("share_invitation"),
        serde_json::json!({ "item_id": item_id }),
    )
    .await;

    Ok(StatusCode::OK.into_response())
}

/* POST /api/v1/invitations/:invitation_id/decline */
pub async fn decline_invitation(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(invitation_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let user_email: Option<(String,)> = sqlx::query_as("SELECT email FROM users WHERE id = $1")
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let (user_email,) = user_email.ok_or_else(|| ApiError::new(AppError::Unauthorized))?;

    let inv: Option<(String,)> = sqlx::query_as(
        "SELECT state FROM share_invitations WHERE id = $1 AND invitee_email = $2",
    )
    .bind(invitation_id)
    .bind(&user_email)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (state_val,) = inv.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    if state_val != "pending" {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "invitation is not in pending state".into(),
        )));
    }

    sqlx::query("UPDATE share_invitations SET state = 'declined', updated_at = NOW() WHERE id = $1")
        .bind(invitation_id)
        .execute(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "invitation.declined",
        Some(invitation_id),
        Some("share_invitation"),
        serde_json::json!({}),
    )
    .await;

    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/invitations/:invitation_id */
pub async fn revoke_invitation(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(invitation_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    type InvRow = (Uuid, Uuid, String);
    let inv: Option<InvRow> = sqlx::query_as(
        "SELECT item_id, inviter_id, state FROM share_invitations WHERE id = $1",
    )
    .bind(invitation_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (item_id, inviter_id, inv_state) = inv.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    /* Requester must be inviter OR hold Owner role on the item */
    if inviter_id != auth.user_id {
        let perm: Option<(String,)> = sqlx::query_as(
            "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
        )
        .bind(item_id)
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        match perm {
            None => return Err(ApiError::new(AppError::Forbidden)),
            Some((role,)) if role != "owner" => return Err(ApiError::new(AppError::Forbidden)),
            _ => {}
        }
    }

    if inv_state == "revoked" {
        return Err(ApiError::new(AppError::UnprocessableEntity("invitation already revoked".into())));
    }

    sqlx::query("UPDATE share_invitations SET state = 'revoked', updated_at = NOW() WHERE id = $1")
        .bind(invitation_id)
        .execute(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "invitation.revoked",
        Some(invitation_id),
        Some("share_invitation"),
        serde_json::json!({ "item_id": item_id }),
    )
    .await;

    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/vault/items/:item_id/permissions/:user_id */
pub async fn remove_permission(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((item_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    require_owner_or_coowner(db, item_id, auth.user_id).await?;

    /* Check removal would not leave zero owners */
    let owner_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM credential_permissions WHERE item_id = $1 AND role = 'owner'",
    )
    .bind(item_id)
    .fetch_one(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let target_role: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(target_user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (role,) = target_role.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    if role == "owner" && owner_count.0 <= 1 {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "cannot remove the sole owner".into(),
        )));
    }

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "DELETE FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "DELETE FROM credential_key_envelopes WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "permission.changed",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({ "removed_user_id": target_user_id }),
    )
    .await;

    Ok(StatusCode::OK.into_response())
}
