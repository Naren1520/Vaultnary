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
    name: String,
    credential_type: String,
    parent_item_id: Option<Uuid>,
    tags: Vec<String>,
    notes: Option<String>,
    encrypted_payload: Option<String>,
    payload_metadata: Option<serde_json::Value>,
    encrypted_dek: Option<String>,
}

struct ValidatedArchiveItem {
    id: Uuid,
    name: String,
    credential_type: String,
    parent_item_id: Option<Uuid>,
    tags: Vec<String>,
    notes: Option<String>,
    encrypted_payload: Option<Vec<u8>>,
    payload_metadata: Option<serde_json::Value>,
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

fn validate_item_fields(body: &serde_json::Value) -> Result<(), ApiError> {
    let mut details = vec![];

    /* name */
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if name.is_empty() || name.len() > MAX_NAME_LEN {
        details.push(ErrorDetail {
            field: "name".into(),
            rule: "length_1_255".into(),
        });
    }

    /* credential_type */
    let ctype_str = body
        .get("credential_type")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if CredentialType::from_str(ctype_str).is_none() {
        details.push(ErrorDetail {
            field: "credential_type".into(),
            rule: "invalid_enum".into(),
        });
    }

    /* tags */
    if let Some(tags_val) = body.get("tags") {
        if let Some(arr) = tags_val.as_array() {
            if arr.len() > MAX_TAG_COUNT {
                details.push(ErrorDetail {
                    field: "tags".into(),
                    rule: "max_20".into(),
                });
            }
            for tag in arr {
                let s = tag.as_str().unwrap_or("");
                if s.is_empty() || s.len() > MAX_TAG_LEN {
                    details.push(ErrorDetail {
                        field: "tags".into(),
                        rule: "each_max_50_chars".into(),
                    });
                    break;
                }
            }
        }
    }

    /* encrypted_payload size */
    if let Some(ep) = body.get("encrypted_payload") {
        let len = ep.as_str().map(|s| s.len()).unwrap_or(0);
        if len > MAX_PAYLOAD_BYTES {
            details.push(ErrorDetail {
                field: "encrypted_payload".into(),
                rule: "max_65536_bytes".into(),
            });
        }
    }

    /* notes */
    if let Some(notes) = body.get("notes").and_then(|v| v.as_str()) {
        if notes.len() > MAX_NOTES_LEN {
            details.push(ErrorDetail {
                field: "notes".into(),
                rule: "max_10000_chars".into(),
            });
        }
    }

    if !details.is_empty() {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("Validation failed".into()),
            details,
        ));
    }

    /* Per-type payload_metadata validation (only when metadata is provided) */
    if let Some(ct) = CredentialType::from_str(ctype_str) {
        if let Some(meta) = body.get("payload_metadata") {
            if let Err(missing) = validate_payload_metadata(&ct, meta) {
                let det: Vec<ErrorDetail> = missing
                    .into_iter()
                    .map(|f| ErrorDetail {
                        field: format!("payload_metadata.{f}"),
                        rule: "required".into(),
                    })
                    .collect();
                return Err(ApiError::with_details(
                    AppError::UnprocessableEntity("Missing required metadata fields".into()),
                    det,
                ));
            }
        }
    }

    Ok(())
}

/* POST /api/v1/vault/items                                            */

pub async fn create_item(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    validate_item_fields(&body)?;

    let name = body["name"].as_str().unwrap().trim().to_string();
    let ctype_str = body["credential_type"].as_str().unwrap();
    let parent_item_id: Option<Uuid> = body
        .get("parent_item_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let tags: Vec<String> = body
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let encrypted_payload: Option<&str> = body.get("encrypted_payload").and_then(|v| v.as_str());
    let payload_metadata: Option<&serde_json::Value> = body.get("payload_metadata");
    let notes: Option<&str> = body.get("notes").and_then(|v| v.as_str());
    let encrypted_dek: Option<&str> = body.get("encrypted_dek").and_then(|v| v.as_str());

    let db = state.db();

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
          payload_metadata, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)",
    )
    .bind(item_id)
    .bind(vault_id)
    .bind(&name)
    .bind(ctype_str)
    .bind(parent_item_id)
    .bind(&tags as &[String])
    .bind(encrypted_payload_bytes)
    .bind(payload_metadata)
    .bind(notes)
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

    /* Store key envelope if encrypted_dek provided */
    if let Some(dek) = encrypted_dek_bytes {
        sqlx::query(
            "INSERT INTO credential_key_envelopes (id, item_id, user_id, encrypted_dek, created_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(Uuid::new_v4())
        .bind(item_id)
        .bind(auth.user_id)
        .bind(dek)
        .bind(now)
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
        "item.created",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({ "name": name, "credential_type": ctype_str }),
    )
    .await;

    let meta = VaultItemMeta {
        id: item_id,
        name,
        credential_type: ctype_str.to_string(),
        parent_item_id,
        tags,
        notes: notes.map(String::from),
        payload_metadata: None,
        is_favorite: false,
        last_accessed_at: None,
        created_at: now.to_string(),
        updated_at: now.to_string(),
        inherited_from: None,
    };

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": meta })),
    )
        .into_response())
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

    /* Rows: (id, name, ctype, parent_item_id, tags JSON, notes, is_favorite,
    last_accessed_at, created_at, updated_at) */
    type ItemRow = (
        Uuid,
        String,
        String,
        Option<Uuid>,
        Vec<String>,
        Option<String>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
    );

    let rows: Vec<ItemRow> = if let Some(cursor) = params.cursor {
        sqlx::query_as(
            "SELECT vi.id, vi.name, vi.credential_type, vi.parent_item_id,
                    vi.tags, vi.notes, COALESCE(cp.is_favorite, false),
                    vi.last_accessed_at, vi.created_at, vi.updated_at
             FROM vault_items vi
             JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
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
            "SELECT vi.id, vi.name, vi.credential_type, vi.parent_item_id,
                    vi.tags, vi.notes, COALESCE(cp.is_favorite, false),
                    vi.last_accessed_at, vi.created_at, vi.updated_at
             FROM vault_items vi
             JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
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
            |(id, name, ctype, parent_id, tags_val, notes, is_fav, last_acc, created, updated)| {
                let tags = tags_val;
                VaultItemMeta {
                    id,
                    name,
                    credential_type: ctype,
                    parent_item_id: parent_id,
                    tags,
                    notes,
                    payload_metadata: None,
                    is_favorite: is_fav,
                    last_accessed_at: last_acc.map(|t| t.to_string()),
                    created_at: created.to_string(),
                    updated_at: updated.to_string(),
                    inherited_from: None,
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
        let ancestor: Option<(Uuid, String)> = sqlx::query_as(
            "WITH RECURSIVE ancestors AS (
               SELECT id, name, parent_item_id, 1 AS depth
               FROM vault_items
               WHERE id = $1
               UNION ALL
               SELECT vi.id, vi.name, vi.parent_item_id, a.depth + 1
               FROM vault_items vi
               JOIN ancestors a ON vi.id = a.parent_item_id
             )
             SELECT a.id, a.name
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

        if let Some((anc_id, anc_name)) = ancestor {
            Some(InheritedFrom {
                id: anc_id,
                name: anc_name,
            })
        } else {
            return Err(ApiError::new(AppError::NotFound));
        }
    } else {
        None
    };

    type ItemRow = (
        Uuid,
        String,
        String,
        Option<Uuid>,
        Vec<String>,
        Option<String>,
        Option<serde_json::Value>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
    );

    let row: Option<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type, vi.parent_item_id,
                vi.tags, vi.notes, vi.payload_metadata, COALESCE(cp.is_favorite, false),
                vi.last_accessed_at, vi.created_at, vi.updated_at
         FROM vault_items vi
         LEFT JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $2
         WHERE vi.id = $1",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (
        id,
        name,
        ctype,
        parent_id,
        tags_val,
        notes,
        payload_metadata,
        is_fav,
        last_acc,
        created,
        updated,
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

    let tags = tags_val;
    let meta = VaultItemMeta {
        id,
        name,
        credential_type: ctype,
        parent_item_id: parent_id,
        tags,
        notes,
        payload_metadata,
        is_favorite: is_fav,
        last_accessed_at: last_acc.map(|t| t.to_string()),
        created_at: created.to_string(),
        updated_at: updated.to_string(),
        inherited_from,
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

    validate_item_fields(&body)?;

    let name = body["name"].as_str().unwrap().trim().to_string();
    let ctype_str = body["credential_type"].as_str().unwrap();
    let parent_item_id: Option<Uuid> = body
        .get("parent_item_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let tags: Vec<String> = body
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let encrypted_payload: Option<&str> = body.get("encrypted_payload").and_then(|v| v.as_str());
    let payload_metadata: Option<&serde_json::Value> = body.get("payload_metadata");
    let notes: Option<&str> = body.get("notes").and_then(|v| v.as_str());

    /* Cycle detection when parent_item_id is being set */
    if let Some(proposed_parent) = parent_item_id {
        check_cycle(db, item_id, proposed_parent)
            .await
            .map_err(ApiError::new)?;
    }

    let encrypted_payload_bytes: Option<Vec<u8>> =
        encrypted_payload.map(|s| decode_base64_or_hex(s)).flatten();

    sqlx::query(
        "UPDATE vault_items
         SET name = $1, credential_type = $2, tags = $3, encrypted_payload = $4,
             payload_metadata = $5, notes = $6, parent_item_id = $8, updated_at = NOW()
         WHERE id = $7",
    )
    .bind(&name)
    .bind(ctype_str)
    .bind(&tags as &[String])
    .bind(encrypted_payload_bytes)
    .bind(payload_metadata)
    .bind(notes)
    .bind(item_id)
    .bind(parent_item_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "item.updated",
        Some(item_id),
        Some("vault_item"),
        serde_json::json!({ "name": name }),
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
    let pattern = format!("%{q}%");

    /* Search by name (ILIKE) or notes, and also check tags array contains the query */
    type SearchRow = (Uuid, String, String, Vec<String>);
    let rows: Vec<SearchRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type, vi.tags
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
         WHERE vi.name ILIKE $2
            OR vi.notes ILIKE $2
            OR EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(vi.tags) AS t
               WHERE t ILIKE $2
            )
         ORDER BY vi.name ASC
         LIMIT 50",
    )
    .bind(auth.user_id)
    .bind(&pattern)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct SearchResult {
        id: Uuid,
        name: String,
        credential_type: String,
        tags: Vec<String>,
    }

    let results: Vec<SearchResult> = rows
        .into_iter()
        .map(|(id, name, ctype, tags_val)| SearchResult {
            id,
            name,
            credential_type: ctype,
            tags: tags_val,
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
        String,
        String,
        Option<Uuid>,
        Vec<String>,
        Option<String>,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
    );

    let rows: Vec<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type, vi.parent_item_id,
                vi.tags, vi.notes, vi.last_accessed_at, vi.created_at, vi.updated_at
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
         WHERE cp.is_favorite = true
         ORDER BY vi.name ASC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let items: Vec<VaultItemMeta> = rows
        .into_iter()
        .map(
            |(id, name, ctype, parent_id, tags_val, notes, last_acc, created, updated)| {
                VaultItemMeta {
                    id,
                    name,
                    credential_type: ctype,
                    parent_item_id: parent_id,
                    tags: tags_val,
                    notes,
                    payload_metadata: None,
                    is_favorite: true,
                    last_accessed_at: last_acc.map(|t| t.to_string()),
                    created_at: created.to_string(),
                    updated_at: updated.to_string(),
                    inherited_from: None,
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
        String,
        String,
        Option<Uuid>,
        Vec<String>,
        Option<String>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
    );

    let rows: Vec<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type, vi.parent_item_id,
                vi.tags, vi.notes, COALESCE(cp.is_favorite, false),
                vi.last_accessed_at, vi.created_at, vi.updated_at
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
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
            |(id, name, ctype, parent_id, tags_val, notes, is_fav, last_acc, created, updated)| {
                VaultItemMeta {
                    id,
                    name,
                    credential_type: ctype,
                    parent_item_id: parent_id,
                    tags: tags_val,
                    notes,
                    payload_metadata: None,
                    is_favorite: is_fav,
                    last_accessed_at: last_acc.map(|t| t.to_string()),
                    created_at: created.to_string(),
                    updated_at: updated.to_string(),
                    inherited_from: None,
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
    if archive.version != 1 {
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
            let name = item.name.trim().to_owned();
            if name.is_empty() || name.len() > MAX_NAME_LEN {
                return Err(archive_validation_error("items.name", "length_1_255"));
            }
            if item.tags.len() > MAX_TAG_COUNT {
                return Err(archive_validation_error("items.tags", "max_20"));
            }
            let tags = item
                .tags
                .into_iter()
                .map(|tag| tag.trim().to_owned())
                .collect::<Vec<_>>();
            if tags
                .iter()
                .any(|tag| tag.is_empty() || tag.len() > MAX_TAG_LEN)
            {
                return Err(archive_validation_error("items.tags", "each_max_50_chars"));
            }
            if item
                .notes
                .as_ref()
                .is_some_and(|notes| notes.len() > MAX_NOTES_LEN)
            {
                return Err(archive_validation_error("items.notes", "max_10000_chars"));
            }

            let credential_type = CredentialType::from_str(&item.credential_type)
                .ok_or_else(|| archive_validation_error("items.credential_type", "invalid_enum"))?;
            if let Some(metadata) = item.payload_metadata.as_ref() {
                if validate_payload_metadata(&credential_type, metadata).is_err() {
                    return Err(archive_validation_error(
                        "items.payload_metadata",
                        "missing_required_fields",
                    ));
                }
            }

            let encrypted_payload =
                decode_archive_bytes(item.encrypted_payload.as_deref(), "items.encrypted_payload")?;
            if encrypted_payload
                .as_ref()
                .is_some_and(|payload| payload.is_empty() || payload.len() > MAX_PAYLOAD_BYTES)
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
                .is_some_and(|dek| dek.is_empty() || dek.len() > MAX_PAYLOAD_BYTES)
            {
                return Err(archive_validation_error(
                    "items.encrypted_dek",
                    "invalid_size",
                ));
            }
            if encrypted_payload.is_some() && encrypted_dek.is_none() {
                return Err(archive_validation_error(
                    "items.encrypted_dek",
                    "required_for_encrypted_payload",
                ));
            }

            Ok(ValidatedArchiveItem {
                id: item.id,
                name,
                credential_type: item.credential_type,
                parent_item_id: item.parent_item_id,
                tags,
                notes: item.notes,
                encrypted_payload,
                payload_metadata: item.payload_metadata,
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
        String,
        String,
        Vec<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<serde_json::Value>,
        Option<Vec<u8>>,
    );
    let rows: Vec<ExportRow> = sqlx::query_as(
        "SELECT vi.id, vi.parent_item_id, vi.name, vi.credential_type, vi.tags,
                vi.notes, vi.encrypted_payload, vi.payload_metadata, cke.encrypted_dek
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
    for (
        id,
        parent_item_id,
        name,
        credential_type,
        tags,
        notes,
        encrypted_payload,
        payload_metadata,
        encrypted_dek,
    ) in rows
    {
        if encrypted_payload.is_some() && encrypted_dek.is_none() {
            return Err(ApiError::new(AppError::Internal(anyhow::anyhow!(
                "owned vault item is missing its encrypted key envelope"
            ))));
        }
        items.push(ArchiveItem {
            id,
            name,
            credential_type,
            parent_item_id,
            tags,
            notes,
            encrypted_payload: encrypted_payload.map(hex::encode),
            payload_metadata,
            encrypted_dek: encrypted_dek.map(hex::encode),
        });
    }

    Ok(Json(serde_json::json!({
        "data": VaultArchive { version: 1, items }
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
              encrypted_payload, payload_metadata, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $9)",
        )
        .bind(item.id)
        .bind(vault_id)
        .bind(&item.name)
        .bind(&item.credential_type)
        .bind(&item.tags)
        .bind(&item.encrypted_payload)
        .bind(&item.payload_metadata)
        .bind(&item.notes)
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
    use super::{decode_base64_or_hex, validate_archive, ArchiveItem, VaultArchive};
    use uuid::Uuid;

    fn archive_item(id: Uuid, parent_item_id: Option<Uuid>) -> ArchiveItem {
        ArchiveItem {
            id,
            name: "Credential".into(),
            credential_type: "custom".into(),
            parent_item_id,
            tags: vec!["backup".into()],
            notes: None,
            encrypted_payload: None,
            payload_metadata: None,
            encrypted_dek: None,
        }
    }

    #[test]
    fn archive_validation_accepts_valid_hierarchy() {
        let parent_id = Uuid::new_v4();
        let archive = VaultArchive {
            version: 1,
            items: vec![
                archive_item(parent_id, None),
                archive_item(Uuid::new_v4(), Some(parent_id)),
            ],
        };
        assert!(validate_archive(archive).is_ok());
    }

    #[test]
    fn archive_validation_rejects_duplicate_ids_and_parent_cycles() {
        let id = Uuid::new_v4();
        let duplicate_archive = VaultArchive {
            version: 1,
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
            version: 1,
            items: vec![item],
        };
        assert!(validate_archive(archive).is_err());

        let with_path = serde_json::json!({
            "version": 1,
            "items": [],
            "path": "../../outside"
        });
        assert!(serde_json::from_value::<VaultArchive>(with_path).is_err());
    }

    #[test]
    fn archive_validation_rejects_missing_parent_and_unsupported_version() {
        let archive = VaultArchive {
            version: 1,
            items: vec![archive_item(Uuid::new_v4(), Some(Uuid::new_v4()))],
        };
        assert!(validate_archive(archive).is_err());

        let archive = VaultArchive {
            version: 2,
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
