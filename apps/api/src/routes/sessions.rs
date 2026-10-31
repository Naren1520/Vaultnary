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

/* GET /api/v1/security/sessions — same data as /auth/sessions */
pub async fn list_sessions(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    type Row = (Uuid, OffsetDateTime, Option<OffsetDateTime>, OffsetDateTime, Option<String>, Option<String>, Option<String>);
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id, created_at, last_used_at, expires_at,
                ip_address::text, user_agent, device_fingerprint
         FROM auth_sessions
         WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
         ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct SessionItem {
        id: Uuid,
        created_at: String,
        last_used_at: Option<String>,
        expires_at: String,
        ip_address: Option<String>,
        user_agent: Option<String>,
        device_fingerprint: Option<String>,
    }

    let sessions: Vec<SessionItem> = rows
        .into_iter()
        .map(|(id, ca, lua, ea, ip, ua, fp)| SessionItem {
            id,
            created_at: ca.to_string(),
            last_used_at: lua.map(|t| t.to_string()),
            expires_at: ea.to_string(),
            ip_address: ip,
            user_agent: ua,
            device_fingerprint: fp,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": sessions })))
}

/* GET /api/v1/security/events — 50 most recent audit events for this user */
pub async fn security_events(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    type Row = (Uuid, String, Option<Uuid>, Option<String>, Option<String>, serde_json::Value, OffsetDateTime);
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id, action_type, resource_id, resource_type,
                ip_address::text, metadata, created_at
         FROM audit_events
         WHERE actor_id = $1 OR resource_id = $1
         ORDER BY created_at DESC
         LIMIT 50",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

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
        .map(|(id, at, rid, rt, ip, _meta, ca)| EventItem {
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

/* GET /api/v1/security/invitations — pending invitations for this user's email */
pub async fn security_invitations(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    /* Get user email */
    let user_email: Option<(String,)> = sqlx::query_as("SELECT email FROM users WHERE id = $1")
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (email,) = user_email.ok_or_else(|| ApiError::new(AppError::Unauthorized))?;

    type InvRow = (Uuid, Uuid, String, String, OffsetDateTime);
    let rows: Vec<InvRow> = sqlx::query_as(
        "SELECT id, item_id, role, state, expires_at
         FROM share_invitations
         WHERE invitee_email = $1
           AND state = 'pending'
           AND expires_at > NOW()
         ORDER BY created_at DESC",
    )
    .bind(&email)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct InvItem {
        id: Uuid,
        item_id: Uuid,
        role: String,
        expires_at: String,
    }

    let items: Vec<InvItem> = rows
        .into_iter()
        .map(|(id, item_id, role, _state, exp)| InvItem {
            id, item_id, role, expires_at: exp.to_string(),
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": items })))
}

/* GET /api/v1/security/shared-with-me — items shared with user (not as owner) */
pub async fn shared_with_me(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    type Row = (Uuid, String, String, String);
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type, cp.role
         FROM vault_items vi
         JOIN credential_permissions cp ON cp.item_id = vi.id
         WHERE cp.user_id = $1 AND cp.role != 'owner'
         ORDER BY vi.name ASC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct SharedItem {
        id: Uuid,
        name: String,
        credential_type: String,
        role: String,
    }

    let items: Vec<SharedItem> = rows
        .into_iter()
        .map(|(id, name, ctype, role)| SharedItem { id, name, credential_type: ctype, role })
        .collect();

    Ok(Json(serde_json::json!({ "data": items })))
}
