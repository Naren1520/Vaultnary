use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::ApiError, middleware::auth::AuthUser, state::AppState};
use shared::AppError;

/* GET /api/v1/vault/items/:item_id/children */
pub async fn get_children(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Verify user has at least viewer access to this item */
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

    /* Fetch direct children where user has viewer+ permission */
    type ChildRow = (
        Uuid,
        bool,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );
    let rows: Vec<ChildRow> = sqlx::query_as(
        "SELECT vi.id,
                EXISTS(SELECT 1 FROM vault_items c WHERE c.parent_item_id = vi.id) AS has_children,
                vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $2
         LEFT JOIN credential_key_envelopes cke
           ON cke.item_id = vi.id AND cke.user_id = $2
         WHERE vi.parent_item_id = $1
         ORDER BY vi.created_at ASC",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ChildItem {
        id: Uuid,
        name: String,
        credential_type: String,
        has_children: bool,
        encrypted_metadata: Option<String>,
        encrypted_payload: Option<String>,
        encrypted_dek: Option<String>,
    }

    let items: Vec<ChildItem> = rows
        .into_iter()
        .map(
            |(id, has_children, encrypted_metadata, encrypted_payload, encrypted_dek)| {
                ChildItem {
                    id,
                    name: "Encrypted credential".into(),
                    credential_type: "custom".into(),
                    has_children,
                    encrypted_metadata: encrypted_metadata.map(hex::encode),
                    encrypted_payload: encrypted_payload.map(hex::encode),
                    encrypted_dek: encrypted_dek.map(hex::encode),
                }
            },
        )
        .collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

#[derive(Deserialize)]
pub struct TreeQuery {
    depth: Option<i32>,
}

/* GET /api/v1/vault/tree?depth=N */
pub async fn get_tree(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<TreeQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let depth = params.depth.unwrap_or(2);
    if depth < 1 || depth > 10 {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "depth must be between 1 and 10".into(),
        )));
    }

    let db = state.db();

    /* Recursive CTE: fetch tree N levels deep, only items user can access */
    type TreeRow = (
        Uuid,
        Option<Uuid>,
        i32,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
    );
    let rows: Vec<TreeRow> = sqlx::query_as(
        "WITH RECURSIVE tree AS (
           SELECT vi.id, vi.parent_item_id, 1 AS depth,
                  vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
           FROM vault_items vi
           JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
           LEFT JOIN credential_key_envelopes cke
             ON cke.item_id = vi.id AND cke.user_id = $1
           WHERE vi.parent_item_id IS NULL
           UNION ALL
           SELECT vi.id, vi.parent_item_id, t.depth + 1,
                  vi.encrypted_metadata, vi.encrypted_payload, cke.encrypted_dek
           FROM vault_items vi
           JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
           LEFT JOIN credential_key_envelopes cke
             ON cke.item_id = vi.id AND cke.user_id = $1
           JOIN tree t ON vi.parent_item_id = t.id
           WHERE t.depth < $2
         )
         SELECT t.id, t.parent_item_id, t.depth,
                t.encrypted_metadata, t.encrypted_payload, t.encrypted_dek
         FROM tree t
         ORDER BY t.depth, t.id",
    )
    .bind(auth.user_id)
    .bind(depth)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* For each node, check if it has any children in the DB (even beyond depth) */
    #[derive(Serialize)]
    struct TreeItem {
        id: Uuid,
        name: String,
        credential_type: String,
        parent_item_id: Option<Uuid>,
        depth: i32,
        has_children: bool,
        encrypted_metadata: Option<String>,
        encrypted_payload: Option<String>,
        encrypted_dek: Option<String>,
    }

    let mut items: Vec<TreeItem> = Vec::with_capacity(rows.len());
    for (id, parent_id, d, encrypted_metadata, encrypted_payload, encrypted_dek) in rows {
        let (has_children,): (bool,) =
            sqlx::query_as("SELECT EXISTS(SELECT 1 FROM vault_items WHERE parent_item_id = $1)")
                .bind(id)
                .fetch_one(db)
                .await
                .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        items.push(TreeItem {
            id,
            name: "Encrypted credential".into(),
            credential_type: "custom".into(),
            parent_item_id: parent_id,
            depth: d,
            has_children,
            encrypted_metadata: encrypted_metadata.map(hex::encode),
            encrypted_payload: encrypted_payload.map(hex::encode),
            encrypted_dek: encrypted_dek.map(hex::encode),
        });
    }

    Ok(Json(serde_json::json!({ "data": items })))
}
