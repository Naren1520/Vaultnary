use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/vault/items — stub
pub async fn create_item() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/items — stub
pub async fn list_items() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/items/:item_id — stub
pub async fn get_item() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// PUT /api/v1/vault/items/:item_id — stub
pub async fn update_item() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/vault/items/:item_id — stub
pub async fn delete_item() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/search — stub
pub async fn search_items() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/favorites — stub
pub async fn list_favorites() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/vault/items/:item_id/favorite — stub
pub async fn add_favorite() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/vault/items/:item_id/favorite — stub
pub async fn remove_favorite() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/recent — stub
pub async fn recent_items() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/vault/export — stub
pub async fn export_vault() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/vault/import — stub
pub async fn import_vault() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
