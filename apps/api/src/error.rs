use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use shared::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct ErrorDetail {
    pub field: String,
    pub rule: String,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    details: Vec<ErrorDetail>,
}

pub struct ApiError {
    pub inner: AppError,
    pub details: Vec<ErrorDetail>,
}

impl ApiError {
    pub fn new(inner: AppError) -> Self {
        Self { inner, details: vec![] }
    }

    pub fn with_details(inner: AppError, details: Vec<ErrorDetail>) -> Self {
        Self { inner, details }
    }
}

impl From<AppError> for ApiError {
    fn from(e: AppError) -> Self {
        Self::new(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.inner {
            AppError::NotFound => (StatusCode::NOT_FOUND, "Not found".to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "Forbidden".to_string()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::UnprocessableEntity(msg) => (StatusCode::UNPROCESSABLE_ENTITY, msg.clone()),
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
                "An unexpected error occurred.".to_string(),
            ),
        };

        (status, Json(ErrorBody { error: message, details: self.details })).into_response()
    }
}

/// Convenience: create a 422 with field-level details
pub fn unprocessable(field: &str, rule: &str) -> ApiError {
    ApiError::with_details(
        AppError::UnprocessableEntity(format!("{field}: {rule}")),
        vec![ErrorDetail { field: field.to_string(), rule: rule.to_string() }],
    )
}
