use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/vault/items/:item_id/usage — stub
pub async fn create_usage() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/items/:item_id/usage — stub
pub async fn list_usage() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/vault/items/:item_id/usage/:usage_id — stub
pub async fn delete_usage() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
