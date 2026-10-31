use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    error::ApiError,
    middleware::auth::AuthUser,
    state::AppState,
};
use shared::AppError;

#[derive(Deserialize)]
pub struct AuditQuery {
    action_type: Option<String>,
    limit: Option<i64>,
    cursor: Option<Uuid>,
}

/* GET /api/v1/audit/events */
pub async fn list_events(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Query(params): Query<AuditQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    let limit = params.limit.unwrap_or(50).min(100).max(1);

    type Row = (Uuid, String, Option<Uuid>, Option<String>, Option<String>, OffsetDateTime);

    let rows: Vec<Row> = if let Some(action_filter) = params.action_type {
        sqlx::query_as(
            "SELECT id, action_type, resource_id, resource_type, ip_address::text, created_at
             FROM audit_events
             WHERE actor_id = $1 AND action_type = $2
             ORDER BY created_at DESC
             LIMIT $3",
        )
        .bind(auth.user_id)
        .bind(&action_filter)
        .bind(limit)
        .fetch_all(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?
    } else {
        sqlx::query_as(
            "SELECT id, action_type, resource_id, resource_type, ip_address::text, created_at
             FROM audit_events
             WHERE actor_id = $1
             ORDER BY created_at DESC
             LIMIT $2",
        )
        .bind(auth.user_id)
        .bind(limit)
        .fetch_all(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?
    };

    #[derive(Serialize)]
    struct EventItem {
        id: Uuid,
        action_type: String,
        resource_id: Option<Uuid>,
        resource_type: Option<String>,
        ip_address: Option<String>,
        created_at: String,
    }

    let events: Vec<EventItem> = rows
        .into_iter()
        .map(|(id, at, rid, rt, ip, ca)| EventItem {
            id,
            action_type: at,
            resource_id: rid,
            resource_type: rt,
            ip_address: ip,
            created_at: ca.to_string(),
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": events })))
}
