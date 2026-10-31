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
    error::{ApiError, ErrorDetail},
    middleware::auth::AuthUser,
    state::AppState,
};
use shared::AppError;

const MAX_NAME_LEN: usize = 100;
const MAX_DESC_LEN: usize = 500;

fn validate_project_fields(body: &serde_json::Value) -> Result<(String, Option<String>), ApiError> {
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    if name.is_empty() || name.len() > MAX_NAME_LEN {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("name: must be 1-100 chars".into()),
            vec![ErrorDetail { field: "name".into(), rule: "length_1_100".into() }],
        ));
    }
    let description = body.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    if let Some(ref d) = description {
        if d.len() > MAX_DESC_LEN {
            return Err(ApiError::with_details(
                AppError::UnprocessableEntity("description: max 500 chars".into()),
                vec![ErrorDetail { field: "description".into(), rule: "max_500".into() }],
            ));
        }
    }
    Ok((name, description))
}

/* POST /api/v1/projects */
pub async fn create_project(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let (name, description) = validate_project_fields(&body)?;
    let db = state.db();
    let id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();

    sqlx::query(
        "INSERT INTO projects (id, owner_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&name)
    .bind(&description)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ProjectResp { id: Uuid, name: String, description: Option<String>, created_at: String }
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": ProjectResp {
            id, name, description,
            created_at: now.to_string(),
        }})),
    ).into_response())
}

/* GET /api/v1/projects */
pub async fn list_projects(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    type Row = (Uuid, String, Option<String>, OffsetDateTime);
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id, name, description, created_at FROM projects WHERE owner_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ProjectItem { id: Uuid, name: String, description: Option<String>, created_at: String }
    let items: Vec<ProjectItem> = rows.into_iter().map(|(id, name, desc, ca)| ProjectItem {
        id, name, description: desc, created_at: ca.to_string(),
    }).collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

/* GET /api/v1/projects/:project_id */
pub async fn get_project(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    type Row = (Uuid, String, Option<String>, OffsetDateTime);
    let row: Option<Row> = sqlx::query_as(
        "SELECT id, name, description, created_at FROM projects WHERE id = $1 AND owner_id = $2",
    )
    .bind(project_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (id, name, description, created_at) = row.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    #[derive(Serialize)]
    struct ProjectResp { id: Uuid, name: String, description: Option<String>, created_at: String }
    Ok(Json(serde_json::json!({ "data": ProjectResp { id, name, description, created_at: created_at.to_string() } })))
}

/* PUT /api/v1/projects/:project_id */
pub async fn update_project(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let (name, description) = validate_project_fields(&body)?;
    let db = state.db();

    let result = sqlx::query(
        "UPDATE projects SET name = $1, description = $2, updated_at = NOW()
         WHERE id = $3 AND owner_id = $4",
    )
    .bind(&name)
    .bind(&description)
    .bind(project_id)
    .bind(auth.user_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/projects/:project_id */
pub async fn delete_project(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Verify ownership */
    let exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    )
    .bind(project_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if exists.is_none() {
        return Err(ApiError::new(AppError::NotFound));
    }

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Delete credential usage records for items in this project's services */
    sqlx::query(
        "DELETE FROM credential_usage WHERE service_id IN
         (SELECT id FROM services WHERE project_id = $1)",
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Delete credential usage records directly linked to this project */
    sqlx::query("DELETE FROM credential_usage WHERE project_id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Delete services */
    sqlx::query("DELETE FROM services WHERE project_id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    /* Delete the project */
    sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    Ok(StatusCode::OK.into_response())
}

/* GET /api/v1/projects/:project_id/credentials */
pub async fn project_credentials(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Verify ownership */
    let exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
    )
    .bind(project_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if exists.is_none() {
        return Err(ApiError::new(AppError::NotFound));
    }

    type CredRow = (Uuid, String, String);
    let rows: Vec<CredRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type
         FROM vault_items vi
         JOIN credential_usage cu ON cu.item_id = vi.id
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $2
         WHERE cu.project_id = $1
         GROUP BY vi.id, vi.name, vi.credential_type
         ORDER BY vi.name ASC",
    )
    .bind(project_id)
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct CredItem { id: Uuid, name: String, credential_type: String }
    let items: Vec<CredItem> = rows.into_iter().map(|(id, name, ct)| CredItem { id, name, credential_type: ct }).collect();
    Ok(Json(serde_json::json!({ "data": items })))
}
