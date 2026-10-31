use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/vault/items/:item_id/invitations — stub
pub async fn create_invitation() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/vault/items/:item_id/invitations — stub
pub async fn list_invitations() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/invitations/:invitation_id/accept — stub
pub async fn accept_invitation() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/invitations/:invitation_id/decline — stub
pub async fn decline_invitation() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/invitations/:invitation_id — stub
pub async fn revoke_invitation() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/vault/items/:item_id/permissions/:user_id — stub
pub async fn remove_permission() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
