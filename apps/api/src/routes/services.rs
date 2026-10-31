use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/services — stub
pub async fn create_service() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/services — stub
pub async fn list_services() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/services/:service_id — stub
pub async fn get_service() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// PUT /api/v1/services/:service_id — stub
pub async fn update_service() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/services/:service_id — stub
pub async fn delete_service() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/services/:service_id/credentials — stub
pub async fn service_credentials() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
