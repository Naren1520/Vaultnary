use axum::{http::StatusCode, response::IntoResponse};

/// GET /api/v1/vault/items/:item_id/children — stub
pub async fn get_children() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/tree — stub
pub async fn get_tree() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
