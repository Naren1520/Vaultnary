use std::net::SocketAddr;

use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{
    config::{Config, LogFormat},
    middleware::{
        auth::AuthSessionLayer,
        csrf::CsrfGuardLayer,
        rate_limit::{InMemoryStore, RateLimitConfig, RateLimitLayer},
        request_id::RequestIdLayer,
    },
    routes::api_router,
    state::AppState,
};

pub async fn run() -> anyhow::Result<()> {
    let config = Config::from_env();
    init_tracing(&config);

    info!(port = config.port, app_env = ?config.app_env, "Starting Vaultnary API");

    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await?;
    info!("Connected to PostgreSQL");

    let state = AppState::new(db.clone(), config.clone());

    let cors_origin = std::env::var("CORS_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());

    let cors = CorsLayer::new()
        .allow_origin(
            cors_origin
                .parse::<axum::http::HeaderValue>()
                .expect("invalid CORS_ORIGIN"),
        )
        .allow_methods(AllowMethods::list([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::list([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ]))
        .allow_credentials(true);

    let rate_store = InMemoryStore::new();

    let app = api_router()
        .layer(CsrfGuardLayer)
        .layer(AuthSessionLayer::new(db))
        .layer(RateLimitLayer::new(
            rate_store,
            RateLimitConfig {
                window: std::time::Duration::from_secs(60),
                max_requests: 200,
            },
        ))
        .layer(TraceLayer::new_for_http())
        .layer(RequestIdLayer)
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!(%addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await?;

    Ok(())
}

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
