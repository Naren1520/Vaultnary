use axum::{
    extract::State,
    http::{header, HeaderValue},
    response::IntoResponse,
    Extension, Json,
};
use serde::Serialize;
use time::OffsetDateTime;

use crate::{error::ApiError, middleware::auth::AuthUser, state::AppState};
use shared::AppError;

#[derive(Serialize)]
struct HourlyMetric {
    hour: String,
    reads: i64,
    writes: i64,
    errors: i64,
}

pub async fn account_metrics(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    sqlx::query(
        "DELETE FROM account_request_metrics
         WHERE user_id = $1 AND bucket_start < NOW() - INTERVAL '30 days'",
    )
    .bind(auth.user_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    type Row = (OffsetDateTime, i64, i64, i64);
    let rows: Vec<Row> = sqlx::query_as(
        "WITH hours AS (
            SELECT generate_series(
                date_trunc('hour', NOW()) - INTERVAL '23 hours',
                date_trunc('hour', NOW()),
                INTERVAL '1 hour'
            ) AS hour
         )
         SELECT hours.hour,
                COALESCE(SUM(metrics.read_requests), 0)::BIGINT,
                COALESCE(SUM(metrics.write_requests), 0)::BIGINT,
                COALESCE(SUM(metrics.error_requests), 0)::BIGINT
         FROM hours
         LEFT JOIN account_request_metrics AS metrics
           ON metrics.user_id = $1
          AND metrics.bucket_start >= hours.hour
          AND metrics.bucket_start < hours.hour + INTERVAL '1 hour'
         GROUP BY hours.hour
         ORDER BY hours.hour",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let metrics: Vec<HourlyMetric> = rows
        .into_iter()
        .map(|(hour, reads, writes, errors)| {
            Ok(HourlyMetric {
                hour: crate::time_format::format_timestamp(hour)?,
                reads,
                writes,
                errors,
            })
        })
        .collect::<Result<_, ApiError>>()?;

    Ok(Json(serde_json::json!({ "data": metrics })))
}

pub async fn speed_test(Extension(_auth): Extension<AuthUser>) -> impl IntoResponse {
    const PAYLOAD_SIZE: usize = 128 * 1024;
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut value = OffsetDateTime::now_utc().unix_timestamp_nanos() as u64;
    let payload: String = (0..PAYLOAD_SIZE)
        .map(|_| {
            value ^= value << 13;
            value ^= value >> 7;
            value ^= value << 17;
            ALPHABET[((value >> 32) & 63) as usize] as char
        })
        .collect();

    (
        [(header::CACHE_CONTROL, HeaderValue::from_static("no-store"))],
        Json(serde_json::json!({ "payload": payload })),
    )
}
