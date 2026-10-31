use axum::{http::StatusCode, response::IntoResponse};

/// GET /api/v1/security/sessions — stub (mirrors /auth/sessions)
pub async fn list_sessions() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
