use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/projects — stub
pub async fn create_project() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/projects — stub
pub async fn list_projects() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/projects/:project_id — stub
pub async fn get_project() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// PUT /api/v1/projects/:project_id — stub
pub async fn update_project() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/projects/:project_id — stub
pub async fn delete_project() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/projects/:project_id/credentials — stub
pub async fn project_credentials() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
