use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    task::{Context, Poll},
    time::{Duration, Instant},
};

use axum::{
    body::Body,
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
};
use futures_util::future::BoxFuture;
use tower::{Layer, Service};
use tracing::warn;

/// Configuration for one rate-limit policy.
#[derive(Clone, Debug)]
pub struct RateLimitConfig {
    pub window: Duration,
    pub max_requests: u64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            window: Duration::from_secs(60),
            max_requests: 100,
        }
    }
}

/// In-memory rate limit store.
/// Suitable for single-instance development. For multi-instance production,
/// replace with a Redis/Upstash REST call.
#[derive(Clone, Debug, Default)]
pub struct InMemoryStore {
    inner: Arc<Mutex<HashMap<String, (u64, Instant)>>>,
}

impl InMemoryStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns true if the request is allowed, false if rate-limited.
    pub fn check(&self, key: &str, window: Duration, max: u64) -> bool {
        let mut map = self.inner.lock().unwrap();
        let now = Instant::now();

        if let Some((count, started_at)) = map.get_mut(key) {
            if now.duration_since(*started_at) >= window {
                *count = 1;
                *started_at = now;
                return true;
            }
            *count += 1;
            *count <= max
        } else {
            map.insert(key.to_string(), (1, now));
            true
        }
    }
}

/// Tower layer that wires in the rate-limiter middleware.
#[derive(Clone, Debug)]
pub struct RateLimitLayer {
    store: InMemoryStore,
    config: RateLimitConfig,
}

impl RateLimitLayer {
    pub fn new(store: InMemoryStore, config: RateLimitConfig) -> Self {
        Self { store, config }
    }
}

impl<S> Layer<S> for RateLimitLayer {
    type Service = RateLimitMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RateLimitMiddleware {
            inner,
            store: self.store.clone(),
            config: self.config.clone(),
        }
    }
}

/// The Tower service that enforces the rate limit.
#[derive(Clone, Debug)]
pub struct RateLimitMiddleware<S> {
    inner: S,
    store: InMemoryStore,
    config: RateLimitConfig,
}

impl<S> Service<Request<Body>> for RateLimitMiddleware<S>
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
        let store = self.store.clone();
        let config = self.config.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let ip = extract_ip(&req);
            let key = format!("rl:{}", ip);

            if store.check(&key, config.window, config.max_requests) {
                inner.call(req).await
            } else {
                warn!(%ip, "Rate limit exceeded");
                Ok(rate_limited_response())
            }
        })
    }
}

fn rate_limited_response() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        axum::Json(serde_json::json!({
            "error": "Too many requests. Please try again later."
        })),
    )
        .into_response()
}

fn extract_ip(req: &Request<Body>) -> String {
    if let Some(forwarded) = req.headers().get("x-forwarded-for") {
        if let Ok(s) = forwarded.to_str() {
            if let Some(ip) = s.split(',').next().map(|s| s.trim()) {
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }
    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counter_increments_correctly() {
        let store = InMemoryStore::new();
        let window = Duration::from_secs(60);
        let max = 3u64;
        assert!(store.check("key1", window, max));
        assert!(store.check("key1", window, max));
        assert!(store.check("key1", window, max));
        assert!(!store.check("key1", window, max));
        assert!(!store.check("key1", window, max));
    }

    #[test]
    fn window_resets_after_expiry() {
        let store = InMemoryStore::new();
        let window = Duration::from_millis(10);
        let max = 2u64;
        assert!(store.check("key2", window, max));
        assert!(store.check("key2", window, max));
        assert!(!store.check("key2", window, max));
        std::thread::sleep(Duration::from_millis(20));
        assert!(store.check("key2", window, max));
        assert!(store.check("key2", window, max));
        assert!(!store.check("key2", window, max));
    }

    #[test]
    fn multiple_keys_are_isolated() {
        let store = InMemoryStore::new();
        let window = Duration::from_secs(60);
        let max = 2u64;
        assert!(store.check("client_a", window, max));
        assert!(store.check("client_a", window, max));
        assert!(!store.check("client_a", window, max));
        assert!(store.check("client_b", window, max));
        assert!(store.check("client_b", window, max));
        assert!(!store.check("client_b", window, max));
    }

    #[test]
    fn default_config_has_sane_values() {
        let config = RateLimitConfig::default();
        assert_eq!(config.window, Duration::from_secs(60));
        assert_eq!(config.max_requests, 100);
    }
}
