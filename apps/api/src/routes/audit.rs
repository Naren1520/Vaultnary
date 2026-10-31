use axum::{http::StatusCode, response::IntoResponse};

/// GET /api/v1/audit/events — stub
pub async fn list_events() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
