use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::ApiError,
    middleware::auth::AuthUser,
    state::AppState,
};
use shared::AppError;

#[derive(Serialize)]
struct UserProfile {
    id: Uuid,
    email: String,
    email_verified: bool,
}

/* GET /api/v1/users/:user_id */
pub async fn get_user(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    /* Users can only view their own profile */
    if user_id != auth.user_id {
        return Err(ApiError::new(AppError::Forbidden));
    }
    let db = state.db();
    let row: Option<(Uuid, String, bool)> = sqlx::query_as(
        "SELECT id, email, email_verified FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (id, email, email_verified) = row.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    Ok(Json(serde_json::json!({ "data": UserProfile { id, email, email_verified } })))
}

/* GET /api/v1/users/me */
pub async fn get_me(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    let row: Option<(Uuid, String, bool)> = sqlx::query_as(
        "SELECT id, email, email_verified FROM users WHERE id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (id, email, email_verified) = row.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    Ok(Json(serde_json::json!({ "data": UserProfile { id, email, email_verified } })))
}

#[derive(Deserialize)]
pub struct LookupQuery {
    email: Option<String>,
}

/* GET /api/v1/users/lookup?email=... */
pub async fn lookup_user(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
    Query(params): Query<LookupQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let email = params.email.unwrap_or_default().trim().to_lowercase();
    if email.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("email is required".into())));
    }
    let db = state.db();
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM users WHERE email = $1 AND email_verified = true",
    )
    .bind(&email)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (id,) = row.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    Ok(Json(serde_json::json!({ "data": { "id": id } })))
}

/// POST /api/v1/dev/verify-email — dev only, force-verifies an email
pub async fn dev_verify_email(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config().is_development() {
        return Err(ApiError::new(AppError::NotFound));
    }
    let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
    let db = state.db();
    let result = sqlx::query(
        "UPDATE users SET email_verified = true WHERE email = $1",
    )
    .bind(&email)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(axum::Json(serde_json::json!({ "ok": true, "email": email })))
}

/// POST /api/v1/dev/reset-password — dev only, reset password directly
pub async fn dev_reset_password(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config().is_development() {
        return Err(ApiError::new(AppError::NotFound));
    }
    let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
    let password = body.get("password").and_then(|v| v.as_str()).unwrap_or("");

    if email.is_empty() || password.len() < 12 {
        return Err(ApiError::new(AppError::BadRequest("email and password (12+ chars) required".into())));
    }

    let hash = security::password_hashing::hash_password(password)
        .map_err(|e| ApiError::new(e))?;

    let db = state.db();
    let result = sqlx::query(
        "UPDATE users SET password_hash = $1, email_verified = true WHERE email = $2",
    )
    .bind(&hash)
    .bind(&email)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(axum::Json(serde_json::json!({ "ok": true, "email": email, "message": "password updated and email verified" })))
}
