use axum::{http::StatusCode, response::IntoResponse};

/// POST /api/v1/auth/register — stub
pub async fn register() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/auth/verify-email — stub
pub async fn verify_email() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/resend-verification — stub
pub async fn resend_verification() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/login — stub
pub async fn login() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/logout — stub
pub async fn logout() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/change-password — stub
pub async fn change_password() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/forgot-password — stub
pub async fn forgot_password() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/reset-password — stub
pub async fn reset_password() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/auth/public-keys/:user_id — stub
pub async fn public_keys() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// GET /api/v1/auth/sessions — stub
pub async fn list_sessions() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/auth/sessions/:session_id — stub
pub async fn revoke_session() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// DELETE /api/v1/auth/sessions — bulk revoke stub
pub async fn revoke_all_sessions() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}

/// POST /api/v1/auth/recover — stub
pub async fn recover() -> impl IntoResponse {
    StatusCode::NOT_IMPLEMENTED
}
