use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use shared::AppError;

/// Error detail item, used for field-level validation errors.
#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    pub field: String,
    pub rule: String,
}

/// Structured JSON error body returned by all error responses.
#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    details: Vec<ErrorDetail>,
}

/// Wrapper that implements `IntoResponse` for `AppError`.
///
/// Maps each `AppError` variant to an appropriate HTTP status code and
/// a `{ "error": "...", "details": [...] }` JSON body.
/// Stack traces are never included outside of development.
pub struct ApiError(pub AppError);

impl From<AppError> for ApiError {
    fn from(e: AppError) -> Self {
        Self(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            AppError::NotFound => (StatusCode::NOT_FOUND, "Not found".to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "Forbidden".to_string()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::UnprocessableEntity(msg) => {
                (StatusCode::UNPROCESSABLE_ENTITY, msg.clone())
            }
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "Too many requests. Please try again later.".to_string(),
            ),
            AppError::PayloadTooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "Request payload is too large.".to_string(),
            ),
            AppError::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                // Never expose internal error details outside development
                "An unexpected error occurred.".to_string(),
            ),
        };

        let body = ErrorBody {
            error: message,
            details: vec![],
        };

        (status, Json(body)).into_response()
    }
}


