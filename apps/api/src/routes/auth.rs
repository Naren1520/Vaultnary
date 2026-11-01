use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;
use validator::ValidateEmail;

use crate::{
    error::{unprocessable, ApiError, ErrorDetail},
    middleware::auth::AuthUser,
    middleware::rate_limit::{RateLimitConfig, RateLimitLayer},
    state::AppState,
};
use security::{
    password_hashing::{hash_password, verify_password},
    sessions::{generate_csrf_token, generate_token, hash_token},
};
use shared::AppError;

// Request / response shapes

#[derive(Deserialize)]
pub struct RegisterRequest {
    email: Option<String>,
    password: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    email: Option<String>,
    password: Option<String>,
    device_fingerprint: Option<String>,
}

#[derive(Serialize)]
pub struct LoginResponse {
    csrf_token: String,
}

#[derive(Deserialize)]
pub struct VerifyEmailQuery {
    token: Option<String>,
}

#[derive(Deserialize)]
pub struct ResendVerificationRequest {
    email: Option<String>,
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    current_password: Option<String>,
    new_password: Option<String>,
}

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    email: Option<String>,
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    token: Option<String>,
    new_password: Option<String>,
}

#[derive(Serialize)]
pub struct SessionRecord {
    id: Uuid,
    created_at: String,
    last_used_at: Option<String>,
    expires_at: String,
    ip_address: Option<String>,
    user_agent: Option<String>,
    device_fingerprint: Option<String>,
}

// Validation helpers

fn validate_email(email: &str) -> bool {
    email.validate_email()
}

fn validate_password(password: &str) -> bool {
    password.len() >= 12 && password.len() <= 128
}

fn extract_ip(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
}

fn extract_user_agent(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

fn clear_session_cookie() -> HeaderValue {
    HeaderValue::from_static(
        "vault_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    )
}

fn build_session_cookie(token: &str, secure: bool) -> String {
    let base = format!(
        "vault_session={}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000",
        token
    );
    if secure { format!("{base}; Secure") } else { base }
}

async fn insert_audit(
    db: &PgPool,
    actor_id: Uuid,
    action_type: &str,
    resource_id: Option<Uuid>,
    resource_type: Option<&str>,
    ip: Option<String>,
    metadata: serde_json::Value,
) {
    let _ = sqlx::query(
        "INSERT INTO audit_events (id, actor_id, action_type, resource_id, resource_type, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::inet, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .bind(action_type)
    .bind(resource_id)
    .bind(resource_type)
    .bind(ip.as_deref())
    .bind(metadata)
    .execute(db)
    .await;
}

// Route handlers

/// POST /api/v1/auth/register
pub async fn register(
    State(state): State<AppState>,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<std::net::SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
    let password = body.get("password").and_then(|v| v.as_str()).unwrap_or("");

    if email.is_empty() || password.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("email and password are required".into())));
    }

    let mut details = vec![];
    if !validate_email(&email) {
        details.push(ErrorDetail { field: "email".into(), rule: "format".into() });
    }
    if !validate_password(password) {
        details.push(ErrorDetail { field: "password".into(), rule: "length_12_128".into() });
    }
    if !details.is_empty() {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("Validation failed".into()),
            details,
        ));
    }

    let db = state.db();

    // Check if email already exists - but return same response either way (no enumeration)
    let existing: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if existing.is_some() {
        // Commit no-op and return same 200 - never reveal existence
        return Ok(StatusCode::OK.into_response());
    }

    let password_hash = hash_password(password)
        .map_err(|e| ApiError::new(e))?;

    let user_id = Uuid::new_v4();
    let vault_id = Uuid::new_v4();
    let verify_token = generate_token(128);
    let verify_token_hash = hash_token(&verify_token);
    let expires_at = OffsetDateTime::now_utc() + time::Duration::hours(24);

    // Insert user + vault in single transaction
    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "INSERT INTO users (id, email, password_hash, email_verify_token_hash, email_verify_token_expires_at, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(user_id)
    .bind(&email)
    .bind(&password_hash)
    .bind(&verify_token_hash)
    .bind(expires_at)
    .bind(state.config().is_development()) // auto-verify in development
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query("INSERT INTO vaults (id, owner_id) VALUES ($1, $2)")
        .bind(vault_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let ip = extract_ip(&headers).or_else(|| Some(addr.ip().to_string()));
    insert_audit(db, user_id, "user.registered", None, None, ip, serde_json::json!({})).await;

    // Send verification email via Resend (logs token if key not configured)
    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());
    crate::email::send_verification_email(&email, &verify_token, &frontend_url).await;

    Ok(StatusCode::OK.into_response())
}

/// GET /api/v1/auth/verify-email?token=...
pub async fn verify_email(
    State(state): State<AppState>,
    Query(params): Query<VerifyEmailQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let token = params.token.unwrap_or_default();
    if token.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("token is required".into())));
    }

    let token_hash = hash_token(&token);
    let db = state.db();
    let now = OffsetDateTime::now_utc();

    let row: Option<(Uuid, bool, Option<time::OffsetDateTime>)> = sqlx::query_as(
        "SELECT id, email_verified, email_verify_token_expires_at FROM users WHERE email_verify_token_hash = $1",
    )
    .bind(&token_hash)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (user_id, already_verified, expires_at) = match row {
        None => return Err(ApiError::new(AppError::BadRequest("Invalid or expired verification token".into()))),
        Some(r) => r,
    };

    if already_verified {
        return Err(ApiError::new(AppError::BadRequest("Invalid or expired verification token".into())));
    }

    if expires_at.map(|e| e < now).unwrap_or(true) {
        return Err(ApiError::new(AppError::BadRequest("Invalid or expired verification token".into())));
    }

    sqlx::query(
        "UPDATE users SET email_verified = true, email_verify_token_hash = NULL, email_verify_token_expires_at = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(user_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(StatusCode::OK.into_response())
}

/// POST /api/v1/auth/resend-verification
pub async fn resend_verification(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();

    if email.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("email is required".into())));
    }

    let db = state.db();

    let row: Option<(Uuid, bool)> = sqlx::query_as(
        "SELECT id, email_verified FROM users WHERE email = $1",
    )
    .bind(&email)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    // Always return 200 regardless of account existence
    if let Some((user_id, false)) = row {
        let verify_token = generate_token(128);
        let verify_token_hash = hash_token(&verify_token);
        let expires_at = OffsetDateTime::now_utc() + time::Duration::hours(24);

        sqlx::query(
            "UPDATE users SET email_verify_token_hash = $1, email_verify_token_expires_at = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(&verify_token_hash)
        .bind(expires_at)
        .bind(user_id)
        .execute(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

        tracing::info!(user_id = %user_id, "resend verification token generated");
        let frontend_url = std::env::var("FRONTEND_URL")
            .unwrap_or_else(|_| "http://localhost:5173".to_string());
        crate::email::send_verification_email(&email, &verify_token, &frontend_url).await;
    }

    Ok(StatusCode::OK.into_response())
}

/// POST /api/v1/auth/login
pub async fn login(
    State(state): State<AppState>,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<std::net::SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Result<Response, ApiError> {
    let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
    let password = body.get("password").and_then(|v| v.as_str()).unwrap_or("");
    let device_fingerprint = body.get("device_fingerprint")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| &s[..s.len().min(512)])
        .map(|s| s.to_string());

    if email.is_empty() || password.is_empty() {
        // Perform dummy hash to equalize timing
        let _ = hash_password("dummy-password-for-timing");
        return Err(ApiError::new(AppError::Unauthorized));
    }

    let db = state.db();
    let ip = extract_ip(&headers).or_else(|| Some(addr.ip().to_string()));
    let user_agent = extract_user_agent(&headers);

    let row: Option<(Uuid, String, bool)> = sqlx::query_as(
        "SELECT id, password_hash, email_verified FROM users WHERE email = $1",
    )
    .bind(&email)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (user_id, stored_hash, email_verified) = match row {
        None => {
            // Dummy hash to prevent timing attacks
            let _ = hash_password("dummy-password-timing-equalization");
            return Err(ApiError::new(AppError::Unauthorized));
        }
        Some(r) => r,
    };

    let password_ok = verify_password(&stored_hash, password)
        .map_err(|e| ApiError::new(e))?;

    if !password_ok {
        return Err(ApiError::new(AppError::Unauthorized));
    }

    if !email_verified {
        return Err(ApiError::new(AppError::Forbidden));
    }

    // Generate session and CSRF tokens
    let session_token = generate_token(128);
    let csrf_token = generate_csrf_token();
    let session_token_hash = hash_token(&session_token);
    let csrf_token_hash = hash_token(&csrf_token);
    let expires_at = OffsetDateTime::now_utc() + time::Duration::days(30);

    sqlx::query(
        "INSERT INTO auth_sessions (id, user_id, token_hash, csrf_token_hash, ip_address, user_agent, device_fingerprint, expires_at)
         VALUES ($1, $2, $3, $4, $5::inet, $6, $7, $8)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&session_token_hash)
    .bind(&csrf_token_hash)
    .bind(ip.as_deref())
    .bind(user_agent.as_deref())
    .bind(device_fingerprint.as_deref())
    .bind(expires_at)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        user_id,
        "user.login",
        None,
        None,
        ip.clone(),
        serde_json::json!({ "user_agent": user_agent }),
    ).await;

    let secure = !state.config().is_development();
    let cookie = build_session_cookie(&session_token, secure);

    let mut response = Json(LoginResponse { csrf_token }).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).unwrap(),
    );

    Ok(response)
}

/// POST /api/v1/auth/logout
pub async fn logout(
    State(state): State<AppState>,
    auth: axum::Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    sqlx::query("UPDATE auth_sessions SET revoked = true WHERE id = $1")
        .bind(auth.session_id)
        .execute(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(db, auth.user_id, "user.logout", None, None, None, serde_json::json!({})).await;

    let mut response = StatusCode::OK.into_response();
    response.headers_mut().insert(header::SET_COOKIE, clear_session_cookie());
    Ok(response)
}

/// GET /api/v1/auth/sessions
pub async fn list_sessions(
    State(state): State<AppState>,
    auth: axum::Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let rows: Vec<(Uuid, time::OffsetDateTime, Option<time::OffsetDateTime>, time::OffsetDateTime, Option<String>, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, created_at, last_used_at, expires_at, ip_address::text, user_agent, device_fingerprint
             FROM auth_sessions
             WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
             ORDER BY created_at DESC",
        )
        .bind(auth.user_id)
        .fetch_all(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let sessions: Vec<SessionRecord> = rows
        .into_iter()
        .map(|(id, created_at, last_used_at, expires_at, ip, ua, fp)| SessionRecord {
            id,
            created_at: created_at.to_string(),
            last_used_at: last_used_at.map(|t| t.to_string()),
            expires_at: expires_at.to_string(),
            ip_address: ip,
            user_agent: ua,
            device_fingerprint: fp,
        })
        .collect();

    Ok(Json(serde_json::json!({ "data": sessions })))
}

/// DELETE /api/v1/auth/sessions/:session_id
pub async fn revoke_session(
    State(state): State<AppState>,
    auth: axum::Extension<AuthUser>,
    Path(session_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM auth_sessions WHERE id = $1",
    )
    .bind(session_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match row {
        None => return Err(ApiError::new(AppError::NotFound)),
        Some((owner_id,)) if owner_id != auth.user_id => return Err(ApiError::new(AppError::NotFound)),
        _ => {}
    }

    sqlx::query("UPDATE auth_sessions SET revoked = true WHERE id = $1")
        .bind(session_id)
        .execute(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(
        db,
        auth.user_id,
        "session.revoked",
        Some(session_id),
        Some("session"),
        None,
        serde_json::json!({}),
    ).await;

    Ok(StatusCode::OK.into_response())
}

/// DELETE /api/v1/auth/sessions (bulk revoke all except current)
pub async fn revoke_all_sessions(
    State(state): State<AppState>,
    auth: axum::Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let rows: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM auth_sessions WHERE user_id = $1 AND id != $2 AND revoked = false",
    )
    .bind(auth.user_id)
    .bind(auth.session_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "UPDATE auth_sessions SET revoked = true WHERE user_id = $1 AND id != $2",
    )
    .bind(auth.user_id)
    .bind(auth.session_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    for (revoked_id,) in rows {
        insert_audit(
            db,
            auth.user_id,
            "session.revoked",
            Some(revoked_id),
            Some("session"),
            None,
            serde_json::json!({}),
        ).await;
    }

    Ok(StatusCode::OK.into_response())
}

/// POST /api/v1/auth/change-password
pub async fn change_password(
    State(state): State<AppState>,
    auth: axum::Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let current = body.get("current_password").and_then(|v| v.as_str()).unwrap_or("");
    let new = body.get("new_password").and_then(|v| v.as_str()).unwrap_or("");

    if current.is_empty() || new.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("current_password and new_password are required".into())));
    }

    if !validate_password(new) {
        return Err(unprocessable("new_password", "length_12_128"));
    }

    let db = state.db();

    let row: Option<(String,)> = sqlx::query_as("SELECT password_hash FROM users WHERE id = $1")
        .bind(auth.user_id)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (stored_hash,) = row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    let ok = verify_password(&stored_hash, current).map_err(|e| ApiError::new(e))?;
    if !ok {
        return Err(ApiError::new(AppError::BadRequest("Current password is incorrect".into())));
    }

    let new_hash = hash_password(new).map_err(|e| ApiError::new(e))?;

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
        .bind(&new_hash)
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    // Revoke all other sessions
    sqlx::query("UPDATE auth_sessions SET revoked = true WHERE user_id = $1 AND id != $2")
        .bind(auth.user_id)
        .bind(auth.session_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(db, auth.user_id, "user.password_changed", None, None, None, serde_json::json!({})).await;

    Ok(StatusCode::OK.into_response())
}

/// POST /api/v1/auth/forgot-password
pub async fn forgot_password(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let email = body.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();

    if email.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("email is required".into())));
    }

    let db = state.db();

    let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1 AND email_verified = true")
        .bind(&email)
        .fetch_optional(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match row {
        Some((user_id,)) => {
            let reset_token = generate_token(128);
            let reset_token_hash = hash_token(&reset_token);
            let expires_at = OffsetDateTime::now_utc() + time::Duration::minutes(60);

            sqlx::query(
                "UPDATE users SET password_reset_token_hash = $1, password_reset_token_expires_at = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(&reset_token_hash)
            .bind(expires_at)
            .bind(user_id)
            .execute(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

            tracing::info!(user_id = %user_id, "password reset token generated");
            let frontend_url = std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string());
            crate::email::send_password_reset_email(&email, &reset_token, &frontend_url).await;
        }
        None => {
            // Dummy hash to equalize timing regardless of account existence
            let _ = hash_password("dummy-password-forgot-timing");
        }
    }

    Ok(StatusCode::OK.into_response())
}

/// POST /api/v1/auth/reset-password
pub async fn reset_password(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let token = body.get("token").and_then(|v| v.as_str()).unwrap_or("");
    let new_password = body.get("new_password").and_then(|v| v.as_str()).unwrap_or("");

    if token.is_empty() || new_password.is_empty() {
        return Err(ApiError::new(AppError::BadRequest("token and new_password are required".into())));
    }

    if !validate_password(new_password) {
        return Err(unprocessable("new_password", "length_12_128"));
    }

    let token_hash = hash_token(token);
    let db = state.db();
    let now = OffsetDateTime::now_utc();

    let row: Option<(Uuid, Option<time::OffsetDateTime>)> = sqlx::query_as(
        "SELECT id, password_reset_token_expires_at FROM users WHERE password_reset_token_hash = $1",
    )
    .bind(&token_hash)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (user_id, expires_at) = match row {
        None => return Err(ApiError::new(AppError::BadRequest("Invalid or expired reset token".into()))),
        Some(r) => r,
    };

    if expires_at.map(|e| e < now).unwrap_or(true) {
        return Err(ApiError::new(AppError::BadRequest("Invalid or expired reset token".into())));
    }

    let new_hash = hash_password(new_password).map_err(|e| ApiError::new(e))?;

    let mut tx = db.begin().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "UPDATE users SET password_hash = $1, password_reset_token_hash = NULL, password_reset_token_expires_at = NULL, updated_at = NOW() WHERE id = $2",
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query("UPDATE auth_sessions SET revoked = true WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit().await.map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    insert_audit(db, user_id, "user.password_changed", None, None, None, serde_json::json!({})).await;

    Ok(StatusCode::OK.into_response())
}

/// GET /api/v1/auth/public-keys/:user_id
pub async fn public_keys(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT public_key, fingerprint FROM user_public_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    match row {
        None => Err(ApiError::new(AppError::NotFound)),
        Some((public_key, fingerprint)) => Ok(Json(serde_json::json!({
            "data": { "public_key": public_key, "fingerprint": fingerprint }
        }))),
    }
}


