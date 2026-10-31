use axum::{
    body::Body,
    http::{header, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
};
use futures_util::future::BoxFuture;
use serde::Serialize;
use sqlx::PgPool;
use std::task::{Context, Poll};
use tower::{Layer, Service};
use uuid::Uuid;

/// The authenticated user attached to every valid request as an Axum extension.
///
/// Populated by `AuthSessionLayer`. Route handlers that require authentication
/// extract this with `axum::Extension<AuthUser>`.
#[derive(Debug, Clone)]
pub struct AuthUser {
    /// The authenticated user's UUID primary key.
    pub user_id: Uuid,
    /// The session row UUID.
    pub session_id: Uuid,
    /// SHA-256 hash of the CSRF token -used by `csrf_guard` for validation.
    pub csrf_token_hash: String,
}

/// Tower layer that validates the `vault_session` cookie.
#[derive(Clone, Debug)]
pub struct AuthSessionLayer {
    db: PgPool,
}

impl AuthSessionLayer {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }
}

impl<S> Layer<S> for AuthSessionLayer {
    type Service = AuthSessionMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AuthSessionMiddleware {
            inner,
            db: self.db.clone(),
        }
    }
}

/// The Tower service that performs session validation.
#[derive(Clone, Debug)]
pub struct AuthSessionMiddleware<S> {
    inner: S,
    db: PgPool,
}

impl<S> Service<Request<Body>> for AuthSessionMiddleware<S>
where
    S: Service<Request<Body>, Response = Response> + Send + Clone + 'static,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: Request<Body>) -> Self::Future {
        let db = self.db.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            // Extract the vault_session cookie value.
            let token = match extract_session_cookie(&req) {
                Some(t) => t,
                None => {
                    // No session cookie -pass through without populating AuthUser.
                    // Route handlers that require auth will reject the request.
                    return inner.call(req).await;
                }
            };

            // Hash the token before querying the DB (tokens are stored hashed).
            let token_hash = hash_token(&token);

            // Look up the session by token hash.
            match lookup_session(&db, &token_hash).await {
                Ok(Some(auth_user)) => {
                    // Valid session -attach to request extensions.
                    req.extensions_mut().insert(auth_user);
                    inner.call(req).await
                }
                Ok(None) => {
                    // Invalid, expired, or revoked session -return 401 and clear cookie.
                    Ok(unauthorized_response())
                }
                Err(err) => {
                    tracing::error!(%err, "Database error during session validation");
                    Ok(internal_error_response())
                }
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the raw `vault_session` cookie value from the `Cookie` header.
fn extract_session_cookie(req: &Request<Body>) -> Option<String> {
    let cookie_header = req.headers().get(header::COOKIE)?.to_str().ok()?;

    for pair in cookie_header.split(';') {
        let mut parts = pair.trim().splitn(2, '=');
        let name = parts.next()?.trim();
        let value = parts.next()?.trim();
        if name == "vault_session" {
            return Some(value.to_owned());
        }
    }
    None
}

/// SHA-256 hash of the raw token (hex-encoded).  
/// Mirrors how tokens are stored at session creation time.
fn hash_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Row returned by the session query.
#[derive(sqlx::FromRow)]
struct SessionRow {
    id: Uuid,
    user_id: Uuid,
    csrf_token_hash: String,
}

/// Query `auth_sessions` for a non-expired, non-revoked session matching `token_hash`.
///
/// Returns `Ok(None)` when no valid session is found (not found, expired, revoked).
/// Uses `sqlx::query` (runtime, not compile-time checked macro) so the crate
/// compiles without a live DATABASE_URL at build time.
async fn lookup_session(db: &PgPool, token_hash: &str) -> anyhow::Result<Option<AuthUser>> {
    let row = sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, user_id, csrf_token_hash
        FROM   auth_sessions
        WHERE  token_hash = $1
          AND  revoked    = false
          AND  expires_at > NOW()
        "#,
    )
    .bind(token_hash)
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| AuthUser {
        user_id: r.user_id,
        session_id: r.id,
        csrf_token_hash: r.csrf_token_hash,
    }))
}

/// Build the 401 Unauthorized response that also clears the session cookie.
fn unauthorized_response() -> Response {
    #[derive(Serialize)]
    struct Body {
        error: &'static str,
    }

    let clear_cookie =
        HeaderValue::from_static("vault_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");

    let mut resp = (
        StatusCode::UNAUTHORIZED,
        axum::Json(Body {
            error: "Invalid or expired session",
        }),
    )
        .into_response();

    resp.headers_mut()
        .insert(header::SET_COOKIE, clear_cookie);

    resp
}

/// Build a 500 Internal Server Error response.
fn internal_error_response() -> Response {
    #[derive(Serialize)]
    struct Body {
        error: &'static str,
    }

    (
        StatusCode::INTERNAL_SERVER_ERROR,
        axum::Json(Body {
            error: "An unexpected error occurred",
        }),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_token_is_deterministic() {
        let h1 = hash_token("my-secret-token");
        let h2 = hash_token("my-secret-token");
        assert_eq!(h1, h2);
    }

    #[test]
    fn hash_token_is_hex_encoded_sha256() {
        let h = hash_token("test");
        // SHA-256 produces 32 bytes = 64 hex chars.
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn extract_session_cookie_finds_vault_session() {
        let req = Request::builder()
            .uri("/")
            .header("cookie", "other=abc; vault_session=my_token; another=xyz")
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            extract_session_cookie(&req),
            Some("my_token".to_string())
        );
    }

    #[test]
    fn extract_session_cookie_returns_none_when_absent() {
        let req = Request::builder()
            .uri("/")
            .header("cookie", "other=abc")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_session_cookie(&req), None);
    }

    #[test]
    fn extract_session_cookie_returns_none_without_cookie_header() {
        let req = Request::builder()
            .uri("/")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_session_cookie(&req), None);
    }

    #[test]
    fn unauthorized_response_clears_cookie() {
        let resp = unauthorized_response();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        let set_cookie = resp.headers().get(header::SET_COOKIE).unwrap();
        let v = set_cookie.to_str().unwrap();
        assert!(v.contains("vault_session="));
        assert!(v.contains("Max-Age=0"));
    }
}
