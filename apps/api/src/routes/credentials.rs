use axum::{http::StatusCode, response::IntoResponse};

/// Credential-related endpoints (key envelopes, public keys) -stub
pub async fn get_key_envelope() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/vault/items/:item_id/key-envelope -stub
pub async fn create_key_envelope() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
