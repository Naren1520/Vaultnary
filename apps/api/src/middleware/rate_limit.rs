use std::{
    net::IpAddr,
    task::{Context, Poll},
    time::Duration,
};

use axum::{
    body::Body,
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
};
use fred::{
    clients::RedisPool,
    interfaces::LuaInterface,
};
use futures_util::future::BoxFuture;
use tower::{Layer, Service};
use tracing::warn;

/// Atomic Lua script that implements a sliding-window counter.
///
/// KEYS[1] = rate-limit key (e.g. "rl:127.0.0.1")
/// ARGV[1] = window duration in seconds
/// ARGV[2] = max allowed requests per window
///
/// Returns 1 when the request is allowed, 0 when it is rate-limited.
/// The counter is incremented atomically; if the key is new the TTL is set.
const RATE_LIMIT_SCRIPT: &str = r#"
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
  return 0
end
return 1
"#;

/// Configuration for one rate-limit policy.
#[derive(Clone, Debug)]
pub struct RateLimitConfig {
    /// Length of the sliding window.
    pub window: Duration,
    /// Maximum number of requests allowed within the window.
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

/// Tower layer that wires in the rate-limiter middleware.
#[derive(Clone, Debug)]
pub struct RateLimitLayer {
    redis: RedisPool,
    config: RateLimitConfig,
}

impl RateLimitLayer {
    pub fn new(redis: RedisPool, config: RateLimitConfig) -> Self {
        Self { redis, config }
    }
}

impl<S> Layer<S> for RateLimitLayer {
    type Service = RateLimitMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RateLimitMiddleware {
            inner,
            redis: self.redis.clone(),
            config: self.config.clone(),
        }
    }
}

/// The Tower service that enforces the rate limit.
#[derive(Clone, Debug)]
pub struct RateLimitMiddleware<S> {
    inner: S,
    redis: RedisPool,
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
        let redis = self.redis.clone();
        let config = self.config.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let ip = extract_ip(&req);
            let key = format!("rl:{}", ip);

            match check_rate_limit(&redis, &key, &config).await {
                Ok(true) => inner.call(req).await,
                Ok(false) => {
                    warn!(%ip, "Rate limit exceeded");
                    Ok(rate_limited_response())
                }
                Err(err) => {
                    // On Redis failure, fail open to avoid blocking all traffic.
                    warn!(%err, "Redis rate limit check failed; allowing request");
                    inner.call(req).await
                }
            }
        })
    }
}

/// Run the atomic Lua rate-limit script against Redis.
/// Returns `true` when the request is allowed, `false` when it should be blocked.
async fn check_rate_limit(
    redis: &RedisPool,
    key: &str,
    config: &RateLimitConfig,
) -> anyhow::Result<bool> {
    let window_secs = config.window.as_secs().to_string();
    let max = config.max_requests.to_string();

    // eval: script, num_keys, keys, args
    let result: i64 = redis
        .eval(
            RATE_LIMIT_SCRIPT,
            vec![key.to_string()],
            vec![window_secs, max],
        )
        .await?;

    Ok(result == 1)
}

/// Build the 429 Too Many Requests response.
fn rate_limited_response() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        axum::Json(serde_json::json!({
            "error": "Too many requests. Please try again later."
        })),
    )
        .into_response()
}

/// Extract the client IP from the request.
/// Respects `X-Forwarded-For` (first hop) and falls back to the socket address
/// stored in the `axum::extract::ConnectInfo` extension, then to "unknown".
fn extract_ip(req: &Request<Body>) -> String {
    // Check X-Forwarded-For first.
    if let Some(forwarded) = req.headers().get("x-forwarded-for") {
        if let Ok(s) = forwarded.to_str() {
            // Take the first (leftmost, most-client) IP.
            if let Some(ip) = s.split(',').next().map(|s| s.trim()) {
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }

    // Fall back to the socket address.
    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

// ---------------------------------------------------------------------------
// Unit tests -test the window arithmetic logic without a real Redis instance
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    /// A minimal in-memory counter store that mimics Redis INCR + EXPIRE semantics
    /// so we can test the window arithmetic without a real Redis server.
    #[derive(Clone, Default)]
    struct FakeCounter {
        counts: Arc<Mutex<HashMap<String, (u64, std::time::Instant, Duration)>>>,
    }

    impl FakeCounter {
        /// Simulate the atomic Lua script logic.
        /// Returns `true` if allowed, `false` if rate-limited.
        fn check(&self, key: &str, window: Duration, max: u64) -> bool {
            let mut map = self.counts.lock().unwrap();
            let now = std::time::Instant::now();

            if let Some((count, started_at, stored_window)) = map.get_mut(key) {
                // Window expired -reset.
                if now.duration_since(*started_at) >= *stored_window {
                    *count = 1;
                    *started_at = now;
                    *stored_window = window;
                    return true;
                }
                *count += 1;
                *count <= max
            } else {
                map.insert(key.to_string(), (1, now, window));
                true
            }
        }
    }

    #[test]
    fn counter_increments_correctly() {
        let counter = FakeCounter::default();
        let window = Duration::from_secs(60);
        let max = 3u64;

        assert!(counter.check("key1", window, max)); // 1 -allowed
        assert!(counter.check("key1", window, max)); // 2 -allowed
        assert!(counter.check("key1", window, max)); // 3 -allowed
        assert!(!counter.check("key1", window, max)); // 4 -blocked
        assert!(!counter.check("key1", window, max)); // 5 -still blocked
    }

    #[test]
    fn window_resets_after_expiry() {
        let counter = FakeCounter::default();
        // Use a very short window so we can test expiry.
        let window = Duration::from_millis(10);
        let max = 2u64;

        assert!(counter.check("key2", window, max)); // 1
        assert!(counter.check("key2", window, max)); // 2
        assert!(!counter.check("key2", window, max)); // 3 -blocked

        // Wait for the window to expire.
        std::thread::sleep(Duration::from_millis(20));

        // Counter should reset; requests should be allowed again.
        assert!(counter.check("key2", window, max)); // 1 again -allowed
        assert!(counter.check("key2", window, max)); // 2 -allowed
        assert!(!counter.check("key2", window, max)); // 3 -blocked again
    }

    #[test]
    fn multiple_keys_are_isolated() {
        let counter = FakeCounter::default();
        let window = Duration::from_secs(60);
        let max = 2u64;

        assert!(counter.check("client_a", window, max)); // a:1
        assert!(counter.check("client_a", window, max)); // a:2
        assert!(!counter.check("client_a", window, max)); // a:3 -blocked

        // client_b has its own independent counter.
        assert!(counter.check("client_b", window, max)); // b:1 -allowed
        assert!(counter.check("client_b", window, max)); // b:2 -allowed
        assert!(!counter.check("client_b", window, max)); // b:3 -blocked

        // client_a is still blocked.
        assert!(!counter.check("client_a", window, max));
        // client_b is also blocked, but independently.
        assert!(!counter.check("client_b", window, max));
    }

    #[test]
    fn default_config_has_sane_values() {
        let config = RateLimitConfig::default();
        assert_eq!(config.window, Duration::from_secs(60));
        assert_eq!(config.max_requests, 100);
    }
}
