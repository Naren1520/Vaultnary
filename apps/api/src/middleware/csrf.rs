use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    response::{IntoResponse, Response},
};
use futures_util::future::BoxFuture;
use std::task::{Context, Poll};
use tower::{Layer, Service};

use crate::middleware::auth::AuthUser;

/// Tower layer that enforces CSRF token validation on mutating requests.
///
/// Only applies to POST, PUT, PATCH, DELETE.
/// Requests without a valid `AuthUser` extension (unauthenticated) are passed
/// through -auth middleware is responsible for blocking unauthenticated access.
#[derive(Clone, Debug, Default)]
pub struct CsrfGuardLayer;

impl<S> Layer<S> for CsrfGuardLayer {
    type Service = CsrfGuardMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        CsrfGuardMiddleware { inner }
    }
}

/// The Tower service that validates `X-CSRF-Token` on mutating requests.
#[derive(Clone, Debug)]
pub struct CsrfGuardMiddleware<S> {
    inner: S,
}

impl<S> Service<Request<Body>> for CsrfGuardMiddleware<S>
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

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let method = req.method().clone();

            // Only validate on mutating methods.
            if !is_mutating(&method) {
                return inner.call(req).await;
            }

            // Public auth endpoints never require CSRF — they create or reset sessions.
            let path = req.uri().path();
            let public_paths = [
                "/api/v1/auth/login",
                "/api/v1/auth/register",
                "/api/v1/auth/forgot-password",
                "/api/v1/auth/reset-password",
                "/api/v1/auth/resend-verification",
                "/api/v1/auth/recover",
                "/api/v1/dev/verify-email",
                "/api/v1/dev/reset-password",
            ];
            if public_paths.contains(&path) {
                return inner.call(req).await;
            }

            // If there is no AuthUser extension the request is unauthenticated —
            // let auth middleware handle it.
            let auth_user = match req.extensions().get::<AuthUser>() {
                Some(u) => u.clone(),
                None => return inner.call(req).await,
            };

            // Extract the X-CSRF-Token header.
            let provided_token = match req.headers().get("x-csrf-token") {
                Some(v) => match v.to_str() {
                    Ok(s) => s.to_owned(),
                    Err(_) => return Ok(forbidden_response()),
                },
                None => return Ok(forbidden_response()),
            };

            // Hash the provided token and compare to the stored hash.
            let provided_hash = hash_token(&provided_token);

            if provided_hash != auth_user.csrf_token_hash {
                return Ok(forbidden_response());
            }

            inner.call(req).await
        })
    }
}

/// Returns true for HTTP methods that modify state.
fn is_mutating(method: &Method) -> bool {
    matches!(
        *method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    )
}

/// SHA-256 hash of the raw token (hex-encoded).
fn hash_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Build a 403 Forbidden response.
fn forbidden_response() -> Response {
    (
        StatusCode::FORBIDDEN,
        axum::Json(serde_json::json!({
            "error": "Invalid or missing CSRF token"
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use std::future::Ready;
    use std::task::{Context as TaskCtx, Poll};
    use tower::ServiceExt;
    use uuid::Uuid;

    /// A minimal Clone+Send service that always returns 200 OK.
    #[derive(Clone)]
    struct OkService;

    impl Service<Request<Body>> for OkService {
        type Response = Response;
        type Error = std::convert::Infallible;
        type Future = Ready<Result<Response, std::convert::Infallible>>;

        fn poll_ready(&mut self, _cx: &mut TaskCtx<'_>) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn call(&mut self, _req: Request<Body>) -> Self::Future {
            std::future::ready(Ok(
                axum::http::Response::builder()
                    .status(200)
                    .body(Body::empty())
                    .unwrap(),
            ))
        }
    }

    fn make_auth_user(raw_token: &str) -> AuthUser {
        AuthUser {
            user_id: Uuid::new_v4(),
            session_id: Uuid::new_v4(),
            csrf_token_hash: hash_token(raw_token),
        }
    }

    #[tokio::test]
    async fn get_request_passes_without_csrf_token() {
        let svc = CsrfGuardLayer.layer(OkService);
        let req = Request::builder().method("GET").uri("/").body(Body::empty()).unwrap();
        let resp = svc.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn post_without_auth_user_passes_through() {
        let svc = CsrfGuardLayer.layer(OkService);
        let req = Request::builder().method("POST").uri("/").body(Body::empty()).unwrap();
        let resp = svc.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn valid_csrf_token_passes() {
        let raw_token = "my-valid-csrf-token";
        let auth_user = make_auth_user(raw_token);
        let svc = CsrfGuardLayer.layer(OkService);
        let mut req = Request::builder()
            .method("POST")
            .uri("/")
            .header("x-csrf-token", raw_token)
            .body(Body::empty())
            .unwrap();
        req.extensions_mut().insert(auth_user);
        let resp = svc.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);
    }

    #[tokio::test]
    async fn missing_csrf_token_returns_403() {
        let auth_user = make_auth_user("some-token");
        let svc = CsrfGuardLayer.layer(OkService);
        let mut req = Request::builder().method("POST").uri("/").body(Body::empty()).unwrap();
        req.extensions_mut().insert(auth_user);
        let resp = svc.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn mismatched_csrf_token_returns_403() {
        let auth_user = make_auth_user("correct-token");
        let svc = CsrfGuardLayer.layer(OkService);
        let mut req = Request::builder()
            .method("POST")
            .uri("/")
            .header("x-csrf-token", "wrong-token")
            .body(Body::empty())
            .unwrap();
        req.extensions_mut().insert(auth_user);
        let resp = svc.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn put_patch_delete_also_validated() {
        for method in &["PUT", "PATCH", "DELETE"] {
            let auth_user = make_auth_user("token");
            let svc = CsrfGuardLayer.layer(OkService);
            let mut req = Request::builder()
                .method(*method)
                .uri("/")
                .body(Body::empty())
                .unwrap();
            req.extensions_mut().insert(auth_user);
            let resp = svc.oneshot(req).await.unwrap();
            assert_eq!(resp.status(), 403, "expected 403 for {method} without CSRF token");
        }
    }
}
