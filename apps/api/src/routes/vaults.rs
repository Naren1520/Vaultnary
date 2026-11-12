use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    error::{ApiError, ErrorDetail},
    middleware::auth::AuthUser,
    state::AppState,
};
use domain::{check_cycle, validate_payload_metadata, CredentialType};
use shared::AppError;

/* Maximum sizes per spec */
const MAX_NAME_LEN: usize = 255;
const MAX_TAG_COUNT: usize = 20;
const MAX_TAG_LEN: usize = 50;
const MAX_PAYLOAD_BYTES: usize = 64 * 1024; /* 64 KB */
const MAX_NOTES_LEN: usize = 10_000;
const MAX_ARCHIVE_ITEMS: usize = 100_000;

/* Default / maximum page sizes */
const DEFAULT_LIMIT: i64 = 20;
const MAX_LIMIT: i64 = 100;

/* Response types                                                       */

#[derive(Serialize)]
struct VaultItemMeta {
    id: Uuid,
    name: String,
    credential_type: String,
    parent_item_id: Option<Uuid>,
    tags: Vec<String>,
    notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload_metadata: Option<serde_json::Value>,
    is_favorite: bool,
    last_accessed_at: Option<String>,
    created_at: String,
    updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    inherited_from: Option<InheritedFrom>,
    encrypted_metadata: Option<String>,
    encrypted_payload: Option<String>,
    encrypted_dek: Option<String>,
    metadata_locked: bool,
}

#[derive(Serialize)]
struct InheritedFrom {
    id: Uuid,
    name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct VaultArchive {
    version: u32,
    items: Vec<ArchiveItem>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ArchiveItem {
    id: Uuid,
    parent_item_id: Option<Uuid>,
    encrypted_metadata: Option<String>,
    encrypted_payload: Option<String>,
    encrypted_dek: Option<String>,
}

struct ValidatedArchiveItem {
    id: Uuid,
    parent_item_id: Option<Uuid>,
    encrypted_metadata: Option<Vec<u8>>,
    encrypted_payload: Option<Vec<u8>>,
    encrypted_dek: Option<Vec<u8>>,
}

/* Shared audit helper (mirrors auth.rs)                               */

async fn insert_audit(
    db: &PgPool,
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

/* Input validation helpers                                            */

fn validate_encrypted_item_fields(
    body: &serde_json::Value,
    require_encrypted_dek: bool,
) -> Result<(), ApiError> {
    let mut errors = Vec::new();
    for (field, min, max) in [
        ("encrypted_metadata", 29, MAX_PAYLOAD_BYTES),
        ("encrypted_payload", 29, MAX_PAYLOAD_BYTES),
    ] {
        let encoded = body.get(field).and_then(|value| value.as_str()).unwrap_or("");
        match decode_base64_or_hex(encoded) {
            Some(bytes) if (min..=max).contains(&bytes.len()) => {}
            _ => errors.push(ErrorDetail {
                field: field.into(),
                rule: "invalid_encrypted_length_or_encoding".into(),
            }),
        }
    }
    let encoded_dek = body
        .get("encrypted_dek")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    if require_encrypted_dek || !encoded_dek.is_empty() {
        match decode_base64_or_hex(encoded_dek) {
            Some(bytes) if bytes.len() == 512 => {}
            _ => errors.push(ErrorDetail {
                field: "encrypted_dek".into(),
                rule: "invalid_encrypted_length_or_encoding".into(),
            }),
        }
    }
    if let Some(parent_id) = body.get("parent_item_id") {
        if !parent_id.is_null()
            && parent_id
                .as_str()
                .and_then(|value| Uuid::parse_str(value).ok())
                .is_none()
        {
            errors.push(ErrorDetail {
                field: "parent_item_id".into(),
                rule: "invalid_uuid".into(),
            });
        }
    }
    if !errors.is_empty() {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("Invalid encrypted credential.".into()),
            errors,
        ));
    }
    Ok(())
}

/* POST /api/v1/vault/items                                            */

pub async fn create_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    validate_encrypted_item_fields(&body, true)?;
    let parent_item_id: Option<Uuid> = body
        .get("parent_item_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let encrypted_payload: Option<&str> = body.get("encrypted_payload").and_then(|v| v.as_str());
    let encrypted_metadata: Option<&str> =
        body.get("encrypted_metadata").and_then(|v| v.as_str());
    let encrypted_dek: Option<&str> = body.get("encrypted_dek").and_then(|v| v.as_str());

    let db = state.db();

    let key_material_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM vault_key_material WHERE user_id = $1)")
            .bind(auth.user_id)
            .fetch_one(db)
            .await
            .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    if !key_material_exists {
        return Err(ApiError::new(AppError::Conflict(
            "Initialize and unlock your encrypted vault before adding credentials.".into(),
        )));
    }

    /* Verify the user owns a vault */
    let vault: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM vaults WHERE owner_id = $1 LIMIT 1")
            .bind(auth.user_id)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let vault_id = vault
        .map(|(id,)| id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;

    let item_id = Uuid::new_v4();
    let encrypted_payload_bytes: Option<Vec<u8>> =
        encrypted_payload.map(|s| decode_base64_or_hex(s)).flatten();
    let encrypted_metadata_bytes: Option<Vec<u8>> =
        encrypted_metadata.map(decode_base64_or_hex).flatten();
    let encrypted_dek_bytes: Option<Vec<u8>> = encrypted_dek.and_then(decode_base64_or_hex);

    let now = OffsetDateTime::now_utc();

    let mut tx = db
        .begin()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Insert vault item */
    sqlx::query(
        "INSERT INTO vault_items
         (id, vault_id, name, credential_type, parent_item_id, tags, encrypted_payload,
          payload_metadata, notes, encrypted_metadata, created_at, updated_at)
         VALUES ($1, $2, 'Encrypted credential', 'custom', $3, '{}', $4, NULL, NULL, $5, $6, $6)",
    )
    .bind(item_id)
    .bind(vault_id)
    .bind(parent_item_id)
    .bind(encrypted_payload_bytes.clone())
    .bind(encrypted_metadata_bytes.clone())
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Grant owner permission */
    sqlx::query(
        "INSERT INTO credential_permissions (id, item_id, user_id, role, created_at)
         VALUES ($1, $2, $3, 'owner', $4)",
    )
    .bind(Uuid::new_v4())
    .bind(item_id)
    .bind(auth.user_id)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let dek = encrypted_dek_bytes.ok_or_else(|| {
        ApiError::new(AppError::UnprocessableEntity(
            "The credential encryption key is required.".into(),
        ))
    })?;
    sqlx::query(
        "INSERT INTO credential_key_envelopes (id, item_id, user_id, encrypted_dek, created_at)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(item_id)
    .bind(auth.user_id)
    .bind(dek.clone())
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

    tx.commit()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "item.created",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({ "metadata_encrypted": true }),
    )
    .await;

    let meta = VaultItemMeta {
        id: item_id,
        name: "Encrypted credential".into(),
        credential_type: "custom".into(),
        parent_item_id,
        tags: Vec::new(),
        notes: None,
        payload_metadata: None,
        is_favorite: false,
        last_accessed_at: None,
        created_at: now.to_string(),
        updated_at: now.to_string(),
        inherited_from: None,
        encrypted_metadata: encrypted_metadata_bytes.map(hex::encode),
        encrypted_payload: encrypted_payload_bytes.map(hex::encode),
        encrypted_dek: Some(hex::encode(dek)),
        metadata_locked: true,
    };

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": meta })),
    )
        .into_response())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct EnvImportRequest {
    items: Vec<EncryptedEnvItem>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EncryptedEnvItem {
    encrypted_metadata: String,
    encrypted_payload: String,
    encrypted_dek: String,
}

struct ValidatedEnvItem {
    encrypted_metadata: Vec<u8>,
    encrypted_payload: Vec<u8>,
    encrypted_dek: Vec<u8>,
}

/* POST /api/v1/vault/import-env */
pub(super) async fn import_env(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<EnvImportRequest>,
) -> Result<impl IntoResponse, ApiError> {
    const MAX_ENV_ITEMS: usize = 100;
    if body.items.is_empty() || body.items.len() > MAX_ENV_ITEMS {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("Invalid environment import.".into()),
            vec![ErrorDetail {
                field: "items".into(),
                rule: "must_contain_between_1_and_100_items".into(),
            }],
        ));
    }

    let mut validated_items = Vec::with_capacity(body.items.len());
    for (index, item) in body.items.into_iter().enumerate() {
        let decode_field = |field: &str, encoded: &str, min_bytes: usize, max_bytes: usize| {
            let bytes = decode_base64_or_hex(encoded)
                .filter(|bytes| (min_bytes..=max_bytes).contains(&bytes.len()));
            bytes.ok_or_else(|| {
                ApiError::with_details(
                    AppError::UnprocessableEntity("Invalid encrypted environment variable.".into()),
                    vec![ErrorDetail {
                        field: format!("items[{index}].{field}"),
                        rule: "invalid_encrypted_length_or_encoding".into(),
                    }],
                )
            })
        };
        validated_items.push(ValidatedEnvItem {
            encrypted_metadata: decode_field(
                "encrypted_metadata",
                &item.encrypted_metadata,
                29,
                MAX_PAYLOAD_BYTES,
            )?,
            encrypted_payload: decode_field(
                "encrypted_payload",
                &item.encrypted_payload,
                29,
                MAX_PAYLOAD_BYTES,
            )?,
            encrypted_dek: decode_field("encrypted_dek", &item.encrypted_dek, 512, 512)?,
        });
    }

    let db = state.db();
    let key_material_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM vault_key_material WHERE user_id = $1)")
            .bind(auth.user_id)
            .fetch_one(db)
            .await
            .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    if !key_material_exists {
        return Err(ApiError::new(AppError::Conflict(
            "Initialize and unlock your encrypted vault before importing environment variables."
                .into(),
        )));
    }

    let vault_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM vaults WHERE owner_id = $1 LIMIT 1")
            .bind(auth.user_id)
            .fetch_optional(db)
            .await
            .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    let vault_id = vault_id.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    let now = OffsetDateTime::now_utc();
    let mut tx = db
        .begin()
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

    for item in &validated_items {
        let item_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO vault_items
             (id, vault_id, name, credential_type, parent_item_id, tags, encrypted_payload,
              payload_metadata, notes, encrypted_metadata, created_at, updated_at)
             VALUES ($1, $2, 'Encrypted credential', 'custom', NULL, '{}', $3, NULL, NULL, $4, $5, $5)",
        )
        .bind(item_id)
        .bind(vault_id)
        .bind(&item.encrypted_payload)
        .bind(&item.encrypted_metadata)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

        sqlx::query(
            "INSERT INTO credential_permissions (id, item_id, user_id, role, created_at)
             VALUES ($1, $2, $3, 'owner', $4)",
        )
        .bind(Uuid::new_v4())
        .bind(item_id)
        .bind(auth.user_id)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

        sqlx::query(
            "INSERT INTO credential_key_envelopes (id, item_id, user_id, encrypted_dek, created_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(Uuid::new_v4())
        .bind(item_id)
        .bind(auth.user_id)
        .bind(&item.encrypted_dek)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    }

    tx.commit()
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "item.imported",
        None,
        Some("env_import"),
        serde_json::json!({ "count": validated_items.len() }),
    )
    .await;

    Ok(Json(serde_json::json!({
        "data": { "imported": validated_items.len() }
    })))
}

/* GET /api/v1/vault/items                                             */

#[derive(Deserialize)]
pub struct ListQuery {
    cursor: Option<Uuid>,
    limit: Option<i64>,
}

pub async fn list_items(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<ListQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let limit = params.limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT).max(1);
    let db = state.db();

    /* List responses expose ciphertext only; credential labels are decrypted in the browser. */
    type ItemRow = (
        Uuid,
        Option<Uuid>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );

    let rows: Vec<ItemRow> = if let Some(cursor) = params.cursor {
        sqlx::query_as(
            "SELECT vi.id, vi.parent_item_id, COALESCE(cp.is_favorite, false),
                    vi.last_accessed_at, vi.created_at, vi.updated_at,
                    vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
             FROM vault_items vi
             JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
             LEFT JOIN credential_key_envelopes cke
               ON cke.item_id = vi.id AND cke.user_id = $1
             WHERE vi.created_at < (SELECT created_at FROM vault_items WHERE id = $2)
             ORDER BY vi.created_at DESC
             LIMIT $3",
        )
        .bind(auth.user_id)
        .bind(cursor)
        .bind(limit + 1)
        .fetch_all(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?
    } else {
        sqlx::query_as(
            "SELECT vi.id, vi.parent_item_id, COALESCE(cp.is_favorite, false),
                    vi.last_accessed_at, vi.created_at, vi.updated_at,
                    vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
             FROM vault_items vi
             JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
             LEFT JOIN credential_key_envelopes cke
               ON cke.item_id = vi.id AND cke.user_id = $1
             ORDER BY vi.created_at DESC
             LIMIT $2",
        )
        .bind(auth.user_id)
        .bind(limit + 1)
        .fetch_all(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?
    };

    let has_more = rows.len() as i64 > limit;
    let rows: Vec<ItemRow> = rows.into_iter().take(limit as usize).collect();

    let next_cursor: Option<Uuid> = if has_more {
        rows.last().map(|r| r.0)
    } else {
        None
    };

    let items: Vec<VaultItemMeta> = rows
        .into_iter()
        .map(
            |(
                id,
                parent_id,
                is_fav,
                last_acc,
                created,
                updated,
                encrypted_metadata,
                encrypted_payload,
                encrypted_dek,
            )| {
                VaultItemMeta {
                    id,
                    name: "Encrypted credential".into(),
                    credential_type: "custom".into(),
                    parent_item_id: parent_id,
                    tags: Vec::new(),
                    notes: None,
                    payload_metadata: None,
                    is_favorite: is_fav,
                    last_accessed_at: last_acc.map(|t| t.to_string()),
                    created_at: created.to_string(),
                    updated_at: updated.to_string(),
                    inherited_from: None,
                    metadata_locked: encrypted_metadata.is_none(),
                    encrypted_metadata: encrypted_metadata.map(hex::encode),
                    encrypted_payload: encrypted_payload.map(hex::encode),
                    encrypted_dek: encrypted_dek.map(hex::encode),
                }
            },
        )
        .collect();

    Ok(Json(
        serde_json::json!({ "data": items, "cursor": next_cursor }),
    ))
}

/* GET /api/v1/vault/items/:item_id                                    */

pub async fn get_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Check direct permission */
    let perm_row: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* If no direct permission, look for inherited access via ancestor CTE */
    let inherited_from: Option<InheritedFrom> = if perm_row.is_none() {
        /* Walk up the parent_item_id chain to find nearest ancestor with permission */
        let ancestor: Option<(Uuid,)> = sqlx::query_as(
            "WITH RECURSIVE ancestors AS (
               SELECT id, parent_item_id, 1 AS depth
               FROM vault_items
               WHERE id = $1
               UNION ALL
               SELECT vi.id, vi.parent_item_id, a.depth + 1
               FROM vault_items vi
               JOIN ancestors a ON vi.id = a.parent_item_id
             )
             SELECT a.id
             FROM ancestors a
             JOIN credential_permissions cp ON cp.item_id = a.id AND cp.user_id = $2
             ORDER BY a.depth ASC
             LIMIT 1",
        )
        .bind(item_id)
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        if let Some((anc_id,)) = ancestor {
            Some(InheritedFrom {
                id: anc_id,
                name: "Encrypted credential".into(),
            })
        } else {
            return Err(ApiError::new(AppError::NotFound));
        }
    } else {
        None
    };

    type ItemRow = (
        Uuid,
        Option<Uuid>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );

    let row: Option<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.parent_item_id, COALESCE(cp.is_favorite, false),
                vi.last_accessed_at, vi.created_at, vi.updated_at,
                vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         LEFT JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $2
         LEFT JOIN credential_key_envelopes cke
           ON cke.item_id = vi.id AND cke.user_id = $2
         WHERE vi.id = $1",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (
        id,
        parent_id,
        is_fav,
        last_acc,
        created,
        updated,
        encrypted_metadata,
        encrypted_payload,
        encrypted_dek,
    ) = row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    /* Update last_accessed_at */
    let _ = sqlx::query("UPDATE vault_items SET last_accessed_at = NOW() WHERE id = $1")
        .bind(item_id)
        .execute(db)
        .await;

    insert_audit(
        db,
        auth.user_id,
        "item.accessed",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({}),
    )
    .await;

    let meta = VaultItemMeta {
        id,
        name: "Encrypted credential".into(),
        credential_type: "custom".into(),
        parent_item_id: parent_id,
        tags: Vec::new(),
        notes: None,
        payload_metadata: None,
        is_favorite: is_fav,
        last_accessed_at: last_acc.map(|t| t.to_string()),
        created_at: created.to_string(),
        updated_at: updated.to_string(),
        inherited_from,
        metadata_locked: encrypted_metadata.is_none(),
        encrypted_metadata: encrypted_metadata.map(hex::encode),
        encrypted_payload: encrypted_payload.map(hex::encode),
        encrypted_dek: encrypted_dek.map(hex::encode),
    };

    Ok(Json(serde_json::json!({ "data": meta })))
}

/* PUT /api/v1/vault/items/:item_id                                    */

pub async fn update_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Check permission >= Editor */
    let perm: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match perm {
        None => return Err(ApiError::new(AppError::NotFound)),
        Some((role,)) if role == "viewer" => return Err(ApiError::new(AppError::Forbidden)),
        _ => {}
    }

    validate_encrypted_item_fields(&body, false)?;
    let encrypted_payload: Option<&str> = body.get("encrypted_payload").and_then(|v| v.as_str());
    let encrypted_metadata: Option<&str> =
        body.get("encrypted_metadata").and_then(|v| v.as_str());
    let encrypted_payload_bytes = encrypted_payload
        .and_then(decode_base64_or_hex)
        .ok_or_else(|| {
            ApiError::new(AppError::UnprocessableEntity(
                "The encrypted credential payload is invalid.".into(),
            ))
        })?;
    let encrypted_metadata_bytes = encrypted_metadata
        .and_then(decode_base64_or_hex)
        .ok_or_else(|| {
            ApiError::new(AppError::UnprocessableEntity(
                "The encrypted credential metadata is invalid.".into(),
            ))
        })?;

    sqlx::query(
        "UPDATE vault_items
         SET encrypted_payload = $1, encrypted_metadata = $2, updated_at = NOW()
         WHERE id = $3",
    )
    .bind(encrypted_payload_bytes)
    .bind(encrypted_metadata_bytes)
    .bind(item_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "item.updated",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({ "metadata_encrypted": true }),
    )
    .await;

    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/vault/items/:item_id                                 */

pub async fn delete_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    /* Require explicit confirm: true */
    let confirmed = body
        .get("confirm")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !confirmed {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("confirm: must be true".into()),
            vec![ErrorDetail {
                field: "confirm".into(),
                rule: "required_true".into(),
            }],
        ));
    }

    let db = state.db();

    /* Owner check */
    let perm: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match perm {
        None => return Err(ApiError::new(AppError::NotFound)),
        Some((role,)) if role != "owner" => return Err(ApiError::new(AppError::Forbidden)),
        _ => {}
    }

    /* Collect all descendant ids via recursive CTE */
    let descendant_ids: Vec<(Uuid,)> = sqlx::query_as(
        "WITH RECURSIVE children AS (
           SELECT id FROM vault_items WHERE id = $1
           UNION ALL
           SELECT vi.id FROM vault_items vi JOIN children c ON vi.parent_item_id = c.id
         )
         SELECT id FROM children",
    )
    .bind(item_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let ids: Vec<Uuid> = descendant_ids.into_iter().map(|(id,)| id).collect();

    let mut tx = db
        .begin()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    for id in &ids {
        /* Delete usage records */
        sqlx::query("DELETE FROM credential_usage WHERE item_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        /* Delete key envelopes */
        sqlx::query("DELETE FROM credential_key_envelopes WHERE item_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        /* Delete permissions */
        sqlx::query("DELETE FROM credential_permissions WHERE item_id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    }

    /* Delete all vault items (children first handled by ordering ids) */
    for id in ids.iter().rev() {
        sqlx::query("DELETE FROM vault_items WHERE id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    }

    tx.commit()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "item.deleted",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({}),
    )
    .await;

    Ok(StatusCode::OK.into_response())
}

/* GET /api/v1/vault/search?q=...                                      */

#[derive(Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
}

pub async fn search_items(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<SearchQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let q = params.q.unwrap_or_default();
    if q.is_empty() || q.len() > 200 {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("q: must be 1-200 characters".into()),
            vec![ErrorDetail {
                field: "q".into(),
                rule: "length_1_200".into(),
            }],
        ));
    }

    let db = state.db();
    /* Names and tags are encrypted, so search candidates are filtered in the unlocked client. */
    type SearchRow = (
        Uuid,
        Option<Uuid>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );
    let rows: Vec<SearchRow> = sqlx::query_as(
        "SELECT vi.id, vi.parent_item_id, COALESCE(cp.is_favorite, false),
                vi.last_accessed_at, vi.created_at, vi.updated_at,
                vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
         LEFT JOIN credential_key_envelopes cke
           ON cke.item_id = vi.id AND cke.user_id = $1
         ORDER BY vi.updated_at DESC, vi.id
         LIMIT 500",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let results: Vec<VaultItemMeta> = rows
        .into_iter()
        .map(|(id, parent_id, is_fav, last_acc, created, updated, metadata, payload, dek)| {
            VaultItemMeta {
                id,
                name: "Encrypted credential".into(),
                credential_type: "custom".into(),
                parent_item_id: parent_id,
                tags: Vec::new(),
                notes: None,
                payload_metadata: None,
                is_favorite: is_fav,
                last_accessed_at: last_acc.map(|value| value.to_string()),
                created_at: created.to_string(),
                updated_at: updated.to_string(),
                inherited_from: None,
                metadata_locked: metadata.is_none(),
                encrypted_metadata: metadata.map(hex::encode),
                encrypted_payload: payload.map(hex::encode),
                encrypted_dek: dek.map(hex::encode),
            }
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": results })))
}

/* GET /api/v1/vault/favorites                                         */

pub async fn list_favorites(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    type ItemRow = (
        Uuid,
        Option<Uuid>,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );

    let rows: Vec<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.parent_item_id, vi.last_accessed_at, vi.created_at, vi.updated_at,
                vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
         LEFT JOIN credential_key_envelopes cke
           ON cke.item_id = vi.id AND cke.user_id = $1
         WHERE cp.is_favorite = true
         ORDER BY vi.created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let items: Vec<VaultItemMeta> = rows
        .into_iter()
        .map(
            |(
                id,
                parent_id,
                last_acc,
                created,
                updated,
                encrypted_metadata,
                encrypted_payload,
                encrypted_dek,
            )| {
                VaultItemMeta {
                    id,
                    name: "Encrypted credential".into(),
                    credential_type: "custom".into(),
                    parent_item_id: parent_id,
                    tags: Vec::new(),
                    notes: None,
                    payload_metadata: None,
                    is_favorite: true,
                    last_accessed_at: last_acc.map(|t| t.to_string()),
                    created_at: created.to_string(),
                    updated_at: updated.to_string(),
                    inherited_from: None,
                    metadata_locked: encrypted_metadata.is_none(),
                    encrypted_metadata: encrypted_metadata.map(hex::encode),
                    encrypted_payload: encrypted_payload.map(hex::encode),
                    encrypted_dek: encrypted_dek.map(hex::encode),
                }
            },
        )
        .collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

/* POST /api/v1/vault/items/:item_id/favorite                          */

pub async fn add_favorite(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Must have at least viewer permission */
    let perm: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM credential_permissions WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if perm.is_none() {
        return Err(ApiError::new(AppError::NotFound));
    }

    /* Upsert is_favorite = true (idempotent) */
    sqlx::query(
        "UPDATE credential_permissions SET is_favorite = true
         WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/vault/items/:item_id/favorite                        */

pub async fn remove_favorite(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Check that is_favorite is currently true */
    let perm: Option<(bool,)> = sqlx::query_as(
        "SELECT COALESCE(is_favorite, false)
         FROM credential_permissions
         WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match perm {
        None => return Err(ApiError::new(AppError::NotFound)),
        Some((false,)) => return Err(ApiError::new(AppError::NotFound)),
        _ => {}
    }

    sqlx::query(
        "UPDATE credential_permissions SET is_favorite = false
         WHERE item_id = $1 AND user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(StatusCode::OK.into_response())
}

/* GET /api/v1/vault/recent                                            */

pub async fn recent_items(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    type ItemRow = (
        Uuid,
        Option<Uuid>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );

    let rows: Vec<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.parent_item_id, COALESCE(cp.is_favorite, false),
                vi.last_accessed_at, vi.created_at, vi.updated_at,
                vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
         LEFT JOIN credential_key_envelopes cke
           ON cke.item_id = vi.id AND cke.user_id = $1
         WHERE vi.last_accessed_at IS NOT NULL
         ORDER BY vi.last_accessed_at DESC
         LIMIT 20",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let items: Vec<VaultItemMeta> = rows
        .into_iter()
        .map(
            |(
                id,
                parent_id,
                is_fav,
                last_acc,
                created,
                updated,
                encrypted_metadata,
                encrypted_payload,
                encrypted_dek,
            )| {
                VaultItemMeta {
                    id,
                    name: "Encrypted credential".into(),
                    credential_type: "custom".into(),
                    parent_item_id: parent_id,
                    tags: Vec::new(),
                    notes: None,
                    payload_metadata: None,
                    is_favorite: is_fav,
                    last_accessed_at: last_acc.map(|t| t.to_string()),
                    created_at: created.to_string(),
                    updated_at: updated.to_string(),
                    inherited_from: None,
                    metadata_locked: encrypted_metadata.is_none(),
                    encrypted_metadata: encrypted_metadata.map(hex::encode),
                    encrypted_payload: encrypted_payload.map(hex::encode),
                    encrypted_dek: encrypted_dek.map(hex::encode),
                }
            },
        )
        .collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

async fn record_archive_event(
    db: &PgPool,
    actor_id: Uuid,
    action_type: &str,
) -> Result<(), ApiError> {
    sqlx::query(
        "INSERT INTO audit_events (id, actor_id, action_type, resource_type, metadata)
         VALUES ($1, $2, $3, 'vault', '{}'::jsonb)",
    )
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .bind(action_type)
    .execute(db)
    .await
    .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    Ok(())
}

fn archive_validation_error(field: &str, rule: &str) -> ApiError {
    ApiError::with_details(
        AppError::UnprocessableEntity("Invalid vault archive".into()),
        vec![ErrorDetail {
            field: field.into(),
            rule: rule.into(),
        }],
    )
}

fn decode_archive_bytes(value: Option<&str>, field: &str) -> Result<Option<Vec<u8>>, ApiError> {
    value
        .map(|value| {
            decode_base64_or_hex(value).ok_or_else(|| archive_validation_error(field, "encoding"))
        })
        .transpose()
}

fn validate_archive(archive: VaultArchive) -> Result<Vec<ValidatedArchiveItem>, ApiError> {
    if archive.version != 2 {
        return Err(archive_validation_error("version", "unsupported"));
    }
    if archive.items.len() > MAX_ARCHIVE_ITEMS {
        return Err(archive_validation_error("items", "too_many"));
    }

    let mut ids = HashSet::with_capacity(archive.items.len());
    for item in &archive.items {
        if !ids.insert(item.id) {
            return Err(archive_validation_error("items.id", "duplicate"));
        }
    }

    let parent_ids: HashMap<Uuid, Option<Uuid>> = archive
        .items
        .iter()
        .map(|item| (item.id, item.parent_item_id))
        .collect();
    for item in &archive.items {
        if item
            .parent_item_id
            .is_some_and(|parent_id| !parent_ids.contains_key(&parent_id))
        {
            return Err(archive_validation_error(
                "items.parent_item_id",
                "not_in_archive",
            ));
        }
    }

    let mut finished = HashSet::with_capacity(archive.items.len());
    for item in &archive.items {
        let mut path = Vec::new();
        let mut active = HashSet::new();
        let mut current = Some(item.id);
        while let Some(item_id) = current {
            if finished.contains(&item_id) {
                break;
            }
            if !active.insert(item_id) {
                return Err(archive_validation_error("items.parent_item_id", "cycle"));
            }
            path.push(item_id);
            current = parent_ids.get(&item_id).copied().flatten();
        }
        finished.extend(path);
    }

    archive
        .items
        .into_iter()
        .map(|item| {
            let encrypted_metadata =
                decode_archive_bytes(item.encrypted_metadata.as_deref(), "items.encrypted_metadata")?;
            if encrypted_metadata.as_ref().is_some_and(|data| {
                data.len() < 29 || data.len() > MAX_PAYLOAD_BYTES
            }) {
                return Err(archive_validation_error(
                    "items.encrypted_metadata",
                    "invalid_size",
                ));
            }
            let encrypted_payload =
                decode_archive_bytes(item.encrypted_payload.as_deref(), "items.encrypted_payload")?;
            if encrypted_payload
                .as_ref()
                .is_some_and(|payload| payload.len() < 29 || payload.len() > MAX_PAYLOAD_BYTES)
            {
                return Err(archive_validation_error(
                    "items.encrypted_payload",
                    "invalid_size",
                ));
            }
            let encrypted_dek =
                decode_archive_bytes(item.encrypted_dek.as_deref(), "items.encrypted_dek")?;
            if encrypted_dek
                .as_ref()
                .is_some_and(|dek| dek.len() != 512)
            {
                return Err(archive_validation_error(
                    "items.encrypted_dek",
                    "invalid_size",
                ));
            }
            if (encrypted_metadata.is_some() || encrypted_payload.is_some())
                && encrypted_dek.is_none()
            {
                return Err(archive_validation_error(
                    "items.encrypted_dek",
                    "required_for_encrypted_data",
                ));
            }

            Ok(ValidatedArchiveItem {
                id: item.id,
                parent_item_id: item.parent_item_id,
                encrypted_metadata,
                encrypted_payload,
                encrypted_dek,
            })
        })
        .collect()
}

/// POST /api/v1/vault/export
pub async fn export_vault(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    record_archive_event(db, auth.user_id, "export.initiated").await?;

    type ExportRow = (
        Uuid,
        Option<Uuid>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );
    let rows: Vec<ExportRow> = sqlx::query_as(
        "SELECT vi.id, vi.parent_item_id, vi.encrypted_metadata,
                vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         JOIN vaults v ON v.id = vi.vault_id
         LEFT JOIN credential_key_envelopes cke
           ON cke.item_id = vi.id AND cke.user_id = $1
         WHERE v.owner_id = $1
         ORDER BY vi.created_at, vi.id",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

    let mut items = Vec::with_capacity(rows.len());
    for (id, parent_item_id, encrypted_metadata, encrypted_payload, encrypted_dek) in rows
    {
        if (encrypted_metadata.is_some() || encrypted_payload.is_some()) && encrypted_dek.is_none()
        {
            return Err(ApiError::new(AppError::Internal(anyhow::anyhow!(
                "owned vault item is missing its encrypted key envelope"
            ))));
        }
        items.push(ArchiveItem {
            id,
            parent_item_id,
            encrypted_metadata: encrypted_metadata.map(hex::encode),
            encrypted_payload: encrypted_payload.map(hex::encode),
            encrypted_dek: encrypted_dek.map(hex::encode),
        });
    }

    Ok(Json(serde_json::json!({
        "data": VaultArchive { version: 2, items }
    })))
}

/// POST /api/v1/vault/import
pub(super) async fn import_vault(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(archive): Json<VaultArchive>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    record_archive_event(db, auth.user_id, "import.initiated").await?;
    let items = validate_archive(archive)?;

    let mut tx = db
        .begin()
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    let vault_id: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM vaults
         WHERE owner_id = $1
         ORDER BY created_at, id
         LIMIT 1
         FOR UPDATE",
    )
    .bind(auth.user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
    let (vault_id,) = vault_id.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    if !items.is_empty() {
        let item_ids = items.iter().map(|item| item.id).collect::<Vec<_>>();
        let duplicate: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM vault_items WHERE id = ANY($1) LIMIT 1")
                .bind(&item_ids)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
        if duplicate.is_some() {
            return Err(ApiError::new(AppError::Conflict(
                "The archive contains items that already exist".into(),
            )));
        }
    }

    let now = OffsetDateTime::now_utc();
    let imported_count = items.len();

    for item in &items {
        sqlx::query(
            "INSERT INTO vault_items
             (id, vault_id, name, credential_type, parent_item_id, tags,
              encrypted_payload, payload_metadata, notes, encrypted_metadata,
              created_at, updated_at)
             VALUES ($1, $2, 'Encrypted credential', 'custom', NULL, '{}',
                     $3, NULL, NULL, $4, $5, $5)",
        )
        .bind(item.id)
        .bind(vault_id)
        .bind(&item.encrypted_payload)
        .bind(&item.encrypted_metadata)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

        sqlx::query(
            "INSERT INTO credential_permissions (id, item_id, user_id, role, granted_at)
             VALUES ($1, $2, $3, 'owner', $4)",
        )
        .bind(Uuid::new_v4())
        .bind(item.id)
        .bind(auth.user_id)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

        if let Some(encrypted_dek) = item.encrypted_dek.as_ref() {
            sqlx::query(
                "INSERT INTO credential_key_envelopes
                 (id, item_id, user_id, encrypted_dek, created_at)
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(Uuid::new_v4())
            .bind(item.id)
            .bind(auth.user_id)
            .bind(encrypted_dek)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
        }
    }

    for item in &items {
        if let Some(parent_item_id) = item.parent_item_id {
            sqlx::query(
                "UPDATE vault_items SET parent_item_id = $1
                 WHERE id = $2 AND vault_id = $3",
            )
            .bind(parent_item_id)
            .bind(item.id)
            .bind(vault_id)
            .execute(&mut *tx)
            .await
            .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;
        }
    }

    tx.commit()
        .await
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))?;

    Ok(Json(serde_json::json!({
        "data": {
            "imported": imported_count
        }
    })))
}

/* Utility                                                             */

fn extract_tags(val: &serde_json::Value) -> Vec<String> {
    val.as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

/// Decode a base64 or hex string to bytes.
/// Returns None if the input is empty or decoding fails.
pub(super) fn decode_base64_or_hex(s: &str) -> Option<Vec<u8>> {
    if s.is_empty() {
        return None;
    }
    // Try hex first (even length, all hex chars)
    if s.len() % 2 == 0 && s.chars().all(|c| c.is_ascii_hexdigit()) {
        return hex::decode(s).ok();
    }
    // Try base64
    let cleaned = s.replace(['\n', '\r', ' '], "");
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    if cleaned.is_empty() || !cleaned.chars().all(|c| alphabet.contains(&(c as u8))) {
        return None;
    }
    let mut table = [255u8; 256];
    for (i, &c) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        .iter()
        .enumerate()
    {
        table[c as usize] = i as u8;
    }
    let bytes = cleaned.as_bytes();
    if bytes.len() % 4 != 0 {
        return None;
    }
    let padding = bytes.iter().rev().take_while(|&&byte| byte == b'=').count();
    if padding > 2 || bytes[..bytes.len().saturating_sub(padding)].contains(&b'=') {
        return None;
    }
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len() / 4 * 3);
    for (index, chunk) in bytes.chunks_exact(4).enumerate() {
        let is_last = index + 1 == bytes.len() / 4;
        let a = table[chunk[0] as usize];
        let b = table[chunk[1] as usize];
        let c_padding = chunk[2] == b'=';
        let d_padding = chunk[3] == b'=';
        if (c_padding && !d_padding) || ((!is_last) && (c_padding || d_padding)) {
            return None;
        }
        let c = if c_padding {
            0
        } else {
            table[chunk[2] as usize]
        };
        let d = if d_padding {
            0
        } else {
            table[chunk[3] as usize]
        };
        if a == 255 || b == 255 {
            return None;
        }
        if (!c_padding && c == 255) || (!d_padding && d == 255) {
            return None;
        }
        if is_last
            && ((padding == 2 && b & 0x0f != 0) || (padding == 1 && !c_padding && c & 0x03 != 0))
        {
            return None;
        }
        out.push((a << 2) | (b >> 4));
        if !c_padding {
            out.push((b << 4) | (c >> 2));
        }
        if !d_padding {
            out.push((c << 6) | d);
        }
    }
    Some(out)
}

#[cfg(test)]
mod archive_tests {
    use super::{
        decode_base64_or_hex, validate_archive, ArchiveItem, EnvImportRequest, VaultArchive,
    };
    use uuid::Uuid;

    fn archive_item(id: Uuid, parent_item_id: Option<Uuid>) -> ArchiveItem {
        ArchiveItem {
            id,
            parent_item_id,
            encrypted_metadata: None,
            encrypted_payload: None,
            encrypted_dek: None,
        }
    }

    #[test]
    fn archive_validation_accepts_valid_hierarchy() {
        let parent_id = Uuid::new_v4();
        let archive = VaultArchive {
            version: 2,
            items: vec![
                archive_item(parent_id, None),
                archive_item(Uuid::new_v4(), Some(parent_id)),
            ],
        };
        assert!(validate_archive(archive).is_ok());
    }

    #[test]
    fn env_import_request_rejects_plaintext_fields() {
        let request = serde_json::json!({
            "items": [{
                "encrypted_metadata": "ciphertext",
                "encrypted_payload": "ciphertext",
                "encrypted_dek": "wrapped-key",
                "name": "DATABASE_URL",
                "value": "must-not-be-sent"
            }]
        });
        assert!(serde_json::from_value::<EnvImportRequest>(request).is_err());
    }

    #[test]
    fn env_import_request_accepts_only_encrypted_item_fields() {
        let request = serde_json::json!({
            "items": [{
                "encrypted_metadata": "ciphertext",
                "encrypted_payload": "ciphertext",
                "encrypted_dek": "wrapped-key"
            }]
        });
        assert!(serde_json::from_value::<EnvImportRequest>(request).is_ok());
    }

    #[test]
    fn archive_validation_rejects_duplicate_ids_and_parent_cycles() {
        let id = Uuid::new_v4();
        let duplicate_archive = VaultArchive {
            version: 2,
            items: vec![archive_item(id, None), archive_item(id, None)],
        };
        assert!(validate_archive(duplicate_archive).is_err());

        let first_id = Uuid::new_v4();
        let second_id = Uuid::new_v4();
        let cyclic_archive = VaultArchive {
            version: 1,
            items: vec![
                archive_item(first_id, Some(second_id)),
                archive_item(second_id, Some(first_id)),
            ],
        };
        assert!(validate_archive(cyclic_archive).is_err());
    }

    #[test]
    fn archive_validation_rejects_invalid_ciphertext_and_unknown_path_fields() {
        let mut item = archive_item(Uuid::new_v4(), None);
        item.encrypted_payload = Some("not a ciphertext!".into());
        let archive = VaultArchive {
            version: 2,
            items: vec![item],
        };
        assert!(validate_archive(archive).is_err());

        let with_path = serde_json::json!({
            "version": 2,
            "items": [],
            "path": "../../outside"
        });
        assert!(serde_json::from_value::<VaultArchive>(with_path).is_err());
    }

    #[test]
    fn archive_validation_rejects_missing_parent_and_unsupported_version() {
        let archive = VaultArchive {
            version: 2,
            items: vec![archive_item(Uuid::new_v4(), Some(Uuid::new_v4()))],
        };
        assert!(validate_archive(archive).is_err());

        let archive = VaultArchive {
            version: 1,
            items: Vec::new(),
        };
        assert!(validate_archive(archive).is_err());
    }

    #[test]
    fn archive_byte_decoder_rejects_malformed_base64_padding() {
        assert_eq!(decode_base64_or_hex("AQID"), Some(vec![1, 2, 3]));
        assert_eq!(decode_base64_or_hex("AQ=="), Some(vec![1]));
        assert!(decode_base64_or_hex("A===").is_none());
        assert!(decode_base64_or_hex("AQ=Z").is_none());
        assert!(decode_base64_or_hex("AR==").is_none());
    }
}
