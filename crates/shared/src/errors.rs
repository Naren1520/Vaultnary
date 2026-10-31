use thiserror::Error;

/// Application-level errors used across all crates.
#[derive(Debug, Error)]
pub enum AppError {
    /// Resource not found (returns 404).
    #[error("Not found")]
    NotFound,

    /// Access to a resource is forbidden (returns 403).
    #[error("Forbidden")]
    Forbidden,

    /// Request is not authenticated (returns 401).
    #[error("Unauthorized")]
    Unauthorized,

    /// Resource already exists or state conflicts (returns 409).
    #[error("Conflict: {0}")]
    Conflict(String),

    /// Request data fails business-rule validation (returns 422).
    #[error("Unprocessable entity: {0}")]
    UnprocessableEntity(String),

    /// Malformed or missing request fields (returns 400).
    #[error("Bad request: {0}")]
    BadRequest(String),

    /// Client has exceeded rate limit (returns 429).
    #[error("Rate limited")]
    RateLimited,

    /// Request payload exceeds the allowed size (returns 413).
    #[error("Payload too large")]
    PayloadTooLarge,

    /// Unexpected server-side failure (returns 500).
    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),
}
