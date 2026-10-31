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

/* POST /api/v1/vault/items/:item_id/usage */
pub async fn create_usage(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Require Editor+ permission */
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

    let project_id: Option<Uuid> = body
        .get("project_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let service_id: Option<Uuid> = body
        .get("service_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    let notes: Option<&str> = body.get("notes").and_then(|v| v.as_str());

    /* Validate that at least one of project_id or service_id is provided */
    if project_id.is_none() && service_id.is_none() {
        return Err(ApiError::new(AppError::UnprocessableEntity(
            "project_id or service_id required".into(),
        )));
    }

    /* Validate project exists */
    if let Some(pid) = project_id {
        let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM projects WHERE id = $1")
            .bind(pid)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        if exists.is_none() {
            return Err(ApiError::new(AppError::NotFound));
        }
    }

    /* Validate service exists */
    if let Some(sid) = service_id {
        let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM services WHERE id = $1")
            .bind(sid)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        if exists.is_none() {
            return Err(ApiError::new(AppError::NotFound));
        }
    }

    /* Check for duplicate */
    let dup: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM credential_usage
         WHERE item_id = $1 AND (project_id = $2 OR (project_id IS NULL AND $2 IS NULL))
           AND (service_id = $3 OR (service_id IS NULL AND $3 IS NULL))",
    )
    .bind(item_id)
    .bind(project_id)
    .bind(service_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if dup.is_some() {
        return Err(ApiError::new(AppError::Conflict("usage record already exists".into())));
    }

    let id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();

    sqlx::query(
        "INSERT INTO credential_usage (id, item_id, project_id, service_id, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(item_id)
    .bind(project_id)
    .bind(service_id)
    .bind(notes)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct UsageResp {
        id: Uuid,
        item_id: Uuid,
        project_id: Option<Uuid>,
        service_id: Option<Uuid>,
        notes: Option<String>,
        created_at: String,
    }
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": UsageResp {
            id, item_id, project_id, service_id,
            notes: notes.map(String::from),
            created_at: now.to_string(),
        }})),
    ).into_response())
}

/* GET /api/v1/vault/items/:item_id/usage */
pub async fn list_usage(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Require Viewer+ permission */
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

    type UsageRow = (Uuid, Option<Uuid>, Option<Uuid>, Option<String>, OffsetDateTime);
    let rows: Vec<UsageRow> = sqlx::query_as(
        "SELECT id, project_id, service_id, notes, created_at
         FROM credential_usage WHERE item_id = $1 ORDER BY created_at DESC",
    )
    .bind(item_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct UsageItem {
        id: Uuid,
        item_id: Uuid,
        project_id: Option<Uuid>,
        service_id: Option<Uuid>,
        notes: Option<String>,
        created_at: String,
    }
    let items: Vec<UsageItem> = rows
        .into_iter()
        .map(|(id, pid, sid, notes, ca)| UsageItem {
            id,
            item_id,
            project_id: pid,
            service_id: sid,
            notes,
            created_at: ca.to_string(),
        })
        .collect();
    Ok(Json(serde_json::json!({ "data": items })))
}

/* DELETE /api/v1/vault/items/:item_id/usage/:usage_id */
pub async fn delete_usage(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path((item_id, usage_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Require Editor+ permission */
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

    let result = sqlx::query(
        "DELETE FROM credential_usage WHERE id = $1 AND item_id = $2",
    )
    .bind(usage_id)
    .bind(item_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(StatusCode::OK.into_response())
}
