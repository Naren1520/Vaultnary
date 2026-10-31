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

const VALID_ENVIRONMENTS: &[&str] = &["development", "staging", "production", "custom"];

fn validate_service_fields(
    body: &serde_json::Value,
) -> Result<(String, Option<String>, String, Option<Uuid>), ApiError> {
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
    let environment = body.get("environment").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if !VALID_ENVIRONMENTS.contains(&environment.as_str()) {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity(
                "environment: must be development, staging, production, or custom".into(),
            ),
            vec![ErrorDetail { field: "environment".into(), rule: "invalid_enum".into() }],
        ));
    }
    let project_id: Option<Uuid> = body
        .get("project_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok());
    Ok((name, description, environment, project_id))
}

/* POST /api/v1/services */
pub async fn create_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let (name, description, environment, project_id) = validate_service_fields(&body)?;
    let db = state.db();

    /* Verify project is accessible if provided */
    if let Some(pid) = project_id {
        let exists: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
        )
        .bind(pid)
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        if exists.is_none() {
            return Err(ApiError::new(AppError::NotFound));
        }
    }

    let id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();
    sqlx::query(
        "INSERT INTO services (id, owner_id, name, description, environment, project_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&name)
    .bind(&description)
    .bind(&environment)
    .bind(project_id)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ServiceResp {
        id: Uuid,
        name: String,
        description: Option<String>,
        environment: String,
        project_id: Option<Uuid>,
        created_at: String,
    }
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": ServiceResp {
            id, name, description, environment, project_id,
            created_at: now.to_string(),
        }})),
    ).into_response())
}

/* GET /api/v1/services */
pub async fn list_services(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    type Row = (Uuid, String, Option<String>, String, Option<Uuid>, OffsetDateTime);
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id, name, description, environment, project_id, created_at
         FROM services WHERE owner_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ServiceItem {
        id: Uuid,
        name: String,
        description: Option<String>,
        environment: String,
        project_id: Option<Uuid>,
        created_at: String,
    }
    let items: Vec<ServiceItem> = rows.into_iter().map(|(id, name, desc, env, pid, ca)| ServiceItem {
        id, name, description: desc, environment: env, project_id: pid, created_at: ca.to_string(),
    }).collect();
    Ok(Json(serde_json::json!({ "data": items })))
}

/* GET /api/v1/services/:service_id */
pub async fn get_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    type Row = (Uuid, String, Option<String>, String, Option<Uuid>, OffsetDateTime);
    let row: Option<Row> = sqlx::query_as(
        "SELECT id, name, description, environment, project_id, created_at
         FROM services WHERE id = $1 AND owner_id = $2",
    )
    .bind(service_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (id, name, description, environment, project_id, created_at) =
        row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    #[derive(Serialize)]
    struct ServiceResp {
        id: Uuid,
        name: String,
        description: Option<String>,
        environment: String,
        project_id: Option<Uuid>,
        created_at: String,
    }
    Ok(Json(serde_json::json!({ "data": ServiceResp {
        id, name, description, environment, project_id, created_at: created_at.to_string(),
    }})))
}

/* PUT /api/v1/services/:service_id */
pub async fn update_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let (name, description, environment, project_id) = validate_service_fields(&body)?;
    let db = state.db();

    /* Verify project is accessible if provided */
    if let Some(pid) = project_id {
        let exists: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
        )
        .bind(pid)
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        if exists.is_none() {
            return Err(ApiError::new(AppError::NotFound));
        }
    }

    let result = sqlx::query(
        "UPDATE services SET name = $1, description = $2, environment = $3, project_id = $4, updated_at = NOW()
         WHERE id = $5 AND owner_id = $6",
    )
    .bind(&name)
    .bind(&description)
    .bind(&environment)
    .bind(project_id)
    .bind(service_id)
    .bind(auth.user_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/services/:service_id */
pub async fn delete_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM services WHERE id = $1 AND owner_id = $2",
    )
    .bind(service_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if exists.is_none() {
        return Err(ApiError::new(AppError::NotFound));
    }

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    sqlx::query("DELETE FROM credential_usage WHERE service_id = $1")
        .bind(service_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    sqlx::query("DELETE FROM services WHERE id = $1")
        .bind(service_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(StatusCode::OK.into_response())
}

/* GET /api/v1/services/:service_id/credentials */
pub async fn service_credentials(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM services WHERE id = $1 AND owner_id = $2",
    )
    .bind(service_id)
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
         WHERE cu.service_id = $1
         GROUP BY vi.id, vi.name, vi.credential_type
         ORDER BY vi.name ASC",
    )
    .bind(service_id)
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct CredItem { id: Uuid, name: String, credential_type: String }
    let items: Vec<CredItem> = rows.into_iter().map(|(id, name, ct)| CredItem { id, name, credential_type: ct }).collect();
    Ok(Json(serde_json::json!({ "data": items })))
}
