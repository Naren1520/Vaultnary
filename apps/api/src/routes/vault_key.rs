use axum::{extract::State, response::IntoResponse, Extension, Json};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::{error::ApiError, middleware::auth::AuthUser, state::AppState};
use shared::AppError;

const SALT_BYTES: usize = 16;
const MIN_PUBLIC_KEY_BYTES: usize = 512;
const MAX_PUBLIC_KEY_BYTES: usize = 8 * 1024;
const MIN_ENCRYPTED_PRIVATE_KEY_BYTES: usize = 64;
const MAX_ENCRYPTED_PRIVATE_KEY_BYTES: usize = 16 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InitializeVaultRequest {
    salt: String,
    encrypted_private_key: String,
    public_key: String,
}

pub async fn get_key_material(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    let material: Option<(Vec<u8>, Vec<u8>)> = sqlx::query_as(
        "SELECT kdf_salt, encrypted_private_key
         FROM vault_key_material WHERE user_id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(internal)?;

    let legacy_item_count: i64 =
        sqlx::query_scalar(
            "SELECT COUNT(DISTINCT vi.id)
             FROM vault_items vi
             JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $1
             WHERE vi.encrypted_metadata IS NULL",
        )
            .bind(auth.user_id)
            .fetch_one(db)
            .await
            .map_err(internal)?;

    let Some((salt, encrypted_private_key)) = material else {
        return Ok(Json(serde_json::json!({
            "data": {
                "configured": false,
                "legacy_item_count": legacy_item_count
            }
        })));
    };

    let public_key: Option<(String, String)> = sqlx::query_as(
        "SELECT public_key, fingerprint FROM user_public_keys
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(internal)?;
    let (public_key, fingerprint) = public_key.ok_or_else(|| {
        ApiError::new(AppError::Internal(anyhow::anyhow!(
            "vault key material has no matching public key"
        )))
    })?;

    Ok(Json(serde_json::json!({
        "data": {
            "configured": true,
            "salt": hex::encode(salt),
            "encrypted_private_key": hex::encode(encrypted_private_key),
            "public_key": public_key,
            "fingerprint": fingerprint,
            "legacy_item_count": legacy_item_count
        }
    })))
}

pub async fn initialize_vault(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<InitializeVaultRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let salt = decode_hex(&body.salt, "salt")?;
    let encrypted_private_key = decode_hex(&body.encrypted_private_key, "encrypted_private_key")?;
    let public_key = decode_hex(&body.public_key, "public_key")?;

    if salt.len() != SALT_BYTES {
        return Err(invalid("salt", "must_be_16_bytes"));
    }
    if !(MIN_ENCRYPTED_PRIVATE_KEY_BYTES..=MAX_ENCRYPTED_PRIVATE_KEY_BYTES)
        .contains(&encrypted_private_key.len())
    {
        return Err(invalid("encrypted_private_key", "invalid_length"));
    }
    if !(MIN_PUBLIC_KEY_BYTES..=MAX_PUBLIC_KEY_BYTES).contains(&public_key.len()) {
        return Err(invalid("public_key", "invalid_length"));
    }

    let fingerprint = hex::encode(Sha256::digest(&public_key));
    let public_key = hex::encode(public_key);
    let mut tx = state.db().begin().await.map_err(internal)?;
    sqlx::query("SELECT id FROM users WHERE id = $1 FOR UPDATE")
        .bind(auth.user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?
        .ok_or_else(|| ApiError::new(AppError::Unauthorized))?;
    let already_configured: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM vault_key_material WHERE user_id = $1)")
            .bind(auth.user_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(internal)?;
    if already_configured {
        return Err(ApiError::new(AppError::Conflict(
            "A vault key is already configured for this account.".into(),
        )));
    }

    sqlx::query(
        "INSERT INTO vault_key_material (user_id, kdf_salt, encrypted_private_key)
         VALUES ($1, $2, $3)",
    )
    .bind(auth.user_id)
    .bind(salt)
    .bind(encrypted_private_key)
    .execute(&mut *tx)
    .await
    .map_err(internal)?;
    sqlx::query(
        "INSERT INTO user_public_keys (user_id, public_key, fingerprint)
         VALUES ($1, $2, $3)",
    )
    .bind(auth.user_id)
    .bind(public_key)
    .bind(fingerprint)
    .execute(&mut *tx)
    .await
    .map_err(internal)?;
    tx.commit().await.map_err(internal)?;

    Ok(Json(serde_json::json!({ "data": { "configured": true } })))
}

fn decode_hex(value: &str, field: &str) -> Result<Vec<u8>, ApiError> {
    if value.is_empty() || value.len() > MAX_ENCRYPTED_PRIVATE_KEY_BYTES * 2 {
        return Err(invalid(field, "invalid_length"));
    }
    hex::decode(value).map_err(|_| invalid(field, "invalid_hex"))
}

fn invalid(field: &str, rule: &str) -> ApiError {
    ApiError::with_details(
        AppError::UnprocessableEntity("Invalid vault key material.".into()),
        vec![crate::error::ErrorDetail {
            field: field.into(),
            rule: rule.into(),
        }],
    )
}

fn internal(error: impl Into<anyhow::Error>) -> ApiError {
    ApiError::new(AppError::Internal(error.into()))
}
