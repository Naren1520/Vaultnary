use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
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
        details.push(ErrorDetail { field: "name".into(), rule: "length_1_255".into() });
    }

    /* credential_type */
    let ctype_str = body.get("credential_type").and_then(|v| v.as_str()).unwrap_or("");
    if CredentialType::from_str(ctype_str).is_none() {
        details.push(ErrorDetail { field: "credential_type".into(), rule: "invalid_enum".into() });
    }

    /* tags */
    if let Some(tags_val) = body.get("tags") {
        if let Some(arr) = tags_val.as_array() {
            if arr.len() > MAX_TAG_COUNT {
                details.push(ErrorDetail { field: "tags".into(), rule: "max_20".into() });
            }
            for tag in arr {
                let s = tag.as_str().unwrap_or("");
                if s.is_empty() || s.len() > MAX_TAG_LEN {
                    details.push(ErrorDetail { field: "tags".into(), rule: "each_max_50_chars".into() });
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
            details.push(ErrorDetail { field: "notes".into(), rule: "max_10000_chars".into() });
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
        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let encrypted_payload: Option<&str> = body.get("encrypted_payload").and_then(|v| v.as_str());
    let payload_metadata: Option<&serde_json::Value> = body.get("payload_metadata");
    let notes: Option<&str> = body.get("notes").and_then(|v| v.as_str());
    let encrypted_dek: Option<&str> = body.get("encrypted_dek").and_then(|v| v.as_str());

    let db = state.db();

    /* Verify the user owns a vault */
    let vault: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM vaults WHERE owner_id = $1 LIMIT 1",
    )
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let vault_id = vault
        .map(|(id,)| id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;

    let item_id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

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
    .bind(encrypted_payload)
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
    if let Some(dek) = encrypted_dek {
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

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

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
        is_favorite: false,
        last_accessed_at: None,
        created_at: now.to_string(),
        updated_at: now.to_string(),
        inherited_from: None,
    };

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "data": meta }))).into_response())
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
    type ItemRow = (Uuid, String, String, Option<Uuid>, Vec<String>,
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
        .map(|(id, name, ctype, parent_id, tags_val, notes, is_fav, last_acc, created, updated)| {
            let tags = tags_val;
            VaultItemMeta {
                id,
                name,
                credential_type: ctype,
                parent_item_id: parent_id,
                tags,
                notes,
                is_favorite: is_fav,
                last_accessed_at: last_acc.map(|t| t.to_string()),
                created_at: created.to_string(),
                updated_at: updated.to_string(),
                inherited_from: None,
            }
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": items, "cursor": next_cursor })))
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
            Some(InheritedFrom { id: anc_id, name: anc_name })
        } else {
            return Err(ApiError::new(AppError::NotFound));
        }
    } else {
        None
    };

    type ItemRow = (Uuid, String, String, Option<Uuid>, Vec<String>,
        Option<String>,
        bool,
        Option<OffsetDateTime>,
        OffsetDateTime,
        OffsetDateTime,
    );

    let row: Option<ItemRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type, vi.parent_item_id,
                vi.tags, vi.notes, COALESCE(cp.is_favorite, false),
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

    let (id, name, ctype, parent_id, tags_val, notes, is_fav, last_acc, created, updated) =
        row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    /* Update last_accessed_at */
    let _ = sqlx::query(
        "UPDATE vault_items SET last_accessed_at = NOW() WHERE id = $1",
    )
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
        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(String::from)).collect())
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

    sqlx::query(
        "UPDATE vault_items
         SET name = $1, credential_type = $2, tags = $3, encrypted_payload = $4,
             payload_metadata = $5, notes = $6, parent_item_id = $8, updated_at = NOW()
         WHERE id = $7",
    )
    .bind(&name)
    .bind(ctype_str)
    .bind(&tags as &[String])
    .bind(encrypted_payload)
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
    let confirmed = body.get("confirm").and_then(|v| v.as_bool()).unwrap_or(false);
    if !confirmed {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("confirm: must be true".into()),
            vec![ErrorDetail { field: "confirm".into(), rule: "required_true".into() }],
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

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

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

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

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
            vec![ErrorDetail { field: "q".into(), rule: "length_1_200".into() }],
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

    type ItemRow = (Uuid, String, String, Option<Uuid>, Vec<String>,
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
        .map(|(id, name, ctype, parent_id, tags_val, notes, last_acc, created, updated)| {
            VaultItemMeta {
                id,
                name,
                credential_type: ctype,
                parent_item_id: parent_id,
                tags: tags_val,
                notes,
                is_favorite: true,
                last_accessed_at: last_acc.map(|t| t.to_string()),
                created_at: created.to_string(),
                updated_at: updated.to_string(),
                inherited_from: None,
            }
        })
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

    type ItemRow = (Uuid, String, String, Option<Uuid>, Vec<String>,
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
        .map(|(id, name, ctype, parent_id, tags_val, notes, is_fav, last_acc, created, updated)| {
            VaultItemMeta {
                id,
                name,
                credential_type: ctype,
                parent_item_id: parent_id,
                tags: tags_val,
                notes,
                is_favorite: is_fav,
                last_accessed_at: last_acc.map(|t| t.to_string()),
                created_at: created.to_string(),
                updated_at: updated.to_string(),
                inherited_from: None,
            }
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

/* POST /api/v1/vault/export -501 stub                               */

pub async fn export_vault() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/* POST /api/v1/vault/import -501 stub                               */

pub async fn import_vault() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/* Utility                                                             */

fn extract_tags(val: &serde_json::Value) -> Vec<String> {
    val.as_array()
        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(String::from)).collect())
        .unwrap_or_default()
}
