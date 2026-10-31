use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    error::ApiError,
    middleware::auth::AuthUser,
    state::AppState,
};
use shared::AppError;

async fn insert_audit(db: &sqlx::PgPool, actor_id: Uuid, action_type: &str) {
    let _ = sqlx::query(
        "INSERT INTO audit_events (id, actor_id, action_type, metadata)
         VALUES ($1, $2, $3, '{}'::jsonb)",
    )
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .bind(action_type)
    .execute(db)
    .await;
}

/* POST /api/v1/recovery/setup (authenticated) */
pub async fn setup_recovery(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let encrypted_private_key = body
        .get("encrypted_private_key")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let integrity_tag = body
        .get("integrity_tag")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let kdf_params = body.get("kdf_params").cloned().unwrap_or(serde_json::json!({}));

    if encrypted_private_key.is_empty() || integrity_tag.is_empty() {
        return Err(ApiError::new(AppError::BadRequest(
            "encrypted_private_key and integrity_tag are required".into(),
        )));
    }

    let db = state.db();
    let now = OffsetDateTime::now_utc();

    /* Decode hex/base64 blobs */
    let key_bytes = decode_bytes(encrypted_private_key).ok_or_else(|| {
        ApiError::new(AppError::BadRequest("encrypted_private_key: invalid encoding".into()))
    })?;
    let tag_bytes = decode_bytes(integrity_tag).ok_or_else(|| {
        ApiError::new(AppError::BadRequest("integrity_tag: invalid encoding".into()))
    })?;

    sqlx::query(
        "INSERT INTO recovery_material
         (id, user_id, encrypted_private_key, integrity_tag, kdf_params, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
         SET encrypted_private_key = EXCLUDED.encrypted_private_key,
             integrity_tag = EXCLUDED.integrity_tag,
             kdf_params = EXCLUDED.kdf_params",
    )
    .bind(Uuid::new_v4())
    .bind(auth.user_id)
    .bind(key_bytes.as_slice())
    .bind(tag_bytes.as_slice())
    .bind(kdf_params)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(StatusCode::OK.into_response())
}

/* GET /api/v1/recovery/setup (authenticated) — returns recovery status */
pub async fn recovery_status(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let exists: Option<(bool,)> = sqlx::query_as(
        "SELECT true FROM recovery_material WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(Json(serde_json::json!({ "data": { "configured": exists.is_some() } })))
}

/* POST /api/v1/auth/recover (unauthenticated) */
pub async fn recover(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let email = body
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();

    if email.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("email is required".into())));
    }

    let db = state.db();

    let row: Option<(Uuid, Vec<u8>, Vec<u8>, serde_json::Value)> = sqlx::query_as(
        "SELECT rm.user_id, rm.encrypted_private_key, rm.integrity_tag, rm.kdf_params
         FROM recovery_material rm
         JOIN users u ON u.id = rm.user_id
         WHERE u.email = $1",
    )
    .bind(&email)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (user_id, encrypted_private_key, integrity_tag, kdf_params) =
        row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    /* Mark password change required */
    let _ = sqlx::query(
        "UPDATE users SET password_change_required = true WHERE id = $1",
    )
    .bind(user_id)
    .execute(db)
    .await;

    insert_audit(db, user_id, "user.recovery_used").await;

    Ok(Json(serde_json::json!({
        "data": {
            "encrypted_private_key": hex::encode(&encrypted_private_key),
            "integrity_tag": hex::encode(&integrity_tag),
            "kdf_params": kdf_params,
        }
    })))
}

fn decode_bytes(s: &str) -> Option<Vec<u8>> {
    /* Try hex first (even length, all hex chars), then base64 */
    if s.len() % 2 == 0 && s.chars().all(|c| c.is_ascii_hexdigit()) {
        return hex::decode(s).ok();
    }
    /* Base64 decode via standard table */
    let s = s.replace(['\n', '\r', ' '], "");
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut table = [255u8; 256];
    for (i, &c) in alphabet.iter().enumerate() {
        table[c as usize] = i as u8;
    }
    let bytes = s.as_bytes();
    if bytes.len() % 4 != 0 {
        return None;
    }
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len() / 4 * 3);
    let mut i = 0;
    while i < bytes.len() {
        let a = table[bytes[i] as usize];
        let b = table[bytes[i + 1] as usize];
        let c = if bytes[i + 2] == b'=' { 0 } else { table[bytes[i + 2] as usize] };
        let d = if bytes[i + 3] == b'=' { 0 } else { table[bytes[i + 3] as usize] };
        if a == 255 || b == 255 || c == 255 || d == 255 {
            return None;
        }
        out.push((a << 2) | (b >> 4));
        if bytes[i + 2] != b'=' {
            out.push((b << 4) | (c >> 2));
        }
        if bytes[i + 3] != b'=' {
            out.push((c << 6) | d);
        }
        i += 4;
    }
    Some(out)
}

fn base64_decode(_s: &str) -> Option<Vec<u8>> { None }
