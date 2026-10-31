use std::net::SocketAddr;

use fred::{clients::RedisPool, interfaces::ClientLike, types::RedisConfig};
use sqlx::postgres::PgPoolOptions;
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    config::{Config, LogFormat},
    middleware::{
        auth::AuthSessionLayer,
        csrf::CsrfGuardLayer,
        rate_limit::{RateLimitConfig, RateLimitLayer},
        request_id::RequestIdLayer,
    },
    routes::api_router,
    state::AppState,
};

/// Entry point called by `main.rs`.
///
/// Middleware order (outermost to innermost):
///   request_id -> tracing -> rate_limiter -> auth_session -> csrf_guard
pub async fn run() -> anyhow::Result<()> {
    let config = Config::from_env();

    init_tracing(&config);

    info!(
        port = config.port,
        app_env = ?config.app_env,
        "Starting Vaultnary API"
    );

    // Postgres
    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await?;
    info!("Connected to PostgreSQL");

    // Redis
    let redis_config = RedisConfig::from_url(&config.redis_url)?;
    let redis = RedisPool::new(redis_config, None, None, None, 6)?;
    redis.connect();
    redis.wait_for_connect().await?;
    info!("Connected to Redis");

    let state = AppState::new(db.clone(), redis.clone(), config.clone());

    // Middleware layers (applied outermost-first via .layer())
    // Axum applies layers from outermost (first .layer() call) to innermost.
    // Execution order: request_id -> tracing -> rate_limiter -> auth_session -> csrf_guard
    let app = api_router()
        // csrf_guard - innermost, runs last; requires AuthUser to be populated
        .layer(CsrfGuardLayer)
        // auth_session - populates AuthUser extension
        .layer(AuthSessionLayer::new(db))
        // rate_limiter - global IP-based rate limit (per-route limits applied separately)
        .layer(RateLimitLayer::new(
            redis,
            RateLimitConfig {
                window: std::time::Duration::from_secs(60),
                max_requests: 200,
            },
        ))
        // tracing - structured request/response spans
        .layer(TraceLayer::new_for_http())
        // request_id - outermost, assigns X-Request-Id first
        .layer(RequestIdLayer)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!(%addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Initialise the global tracing subscriber.
/// JSON format when LOG_FORMAT=json, human-readable otherwise.
fn init_tracing(config: &Config) {
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    match config.log_format {
        LogFormat::Json => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(fmt::layer().json())
                .init();
        }
        LogFormat::Human => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(fmt::layer())
                .init();
        }
    }
}
