use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::error::ApiError;
use shared::AppError;

pub fn format_timestamp(value: OffsetDateTime) -> Result<String, ApiError> {
    value
        .format(&Rfc3339)
        .map_err(|error| ApiError::new(AppError::Internal(error.into())))
}
