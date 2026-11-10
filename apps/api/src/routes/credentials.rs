use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::{error::ApiError, middleware::auth::AuthUser, state::AppState};
use shared::AppError;

/// GET /api/v1/vault/items/:item_id/key-envelope
pub async fn get_key_envelope(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(item_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let envelope: Option<(Option<Vec<u8>>, Vec<u8>)> = sqlx::query_as(
        "SELECT vi.encrypted_payload, cke.encrypted_dek
         FROM vault_items vi
         JOIN credential_key_envelopes cke ON cke.item_id = vi.id
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = cke.user_id
         WHERE vi.id = $1 AND cke.user_id = $2",
    )
    .bind(item_id)
    .bind(auth.user_id)
    .fetch_optional(state.db())
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (encrypted_payload, encrypted_dek) =
        envelope.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    let encrypted_payload = encrypted_payload.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    Ok(Json(serde_json::json!({
        "data": {
            "encrypted_payload": hex::encode(encrypted_payload),
            "encrypted_dek": hex::encode(encrypted_dek),
        }
    })))
}
