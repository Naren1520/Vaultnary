use axum::{http::StatusCode, response::IntoResponse};

/// GET /api/v1/users/:user_id — stub
pub async fn get_user() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
