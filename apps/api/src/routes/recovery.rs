use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/auth/recover — stub
pub async fn recover() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
