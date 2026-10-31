use std::sync::Arc;

use fred::clients::RedisPool;
use sqlx::PgPool;

use crate::config::Config;

/// Shared application state accessible from all route handlers.
///
/// Clone is cheap — all fields are wrapped in Arc or are cheaply cloneable.
#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    pub db: PgPool,
    pub redis: RedisPool,
    pub config: Config,
}

impl AppState {
    pub fn new(db: PgPool, redis: RedisPool, config: Config) -> Self {
        Self {
            inner: Arc::new(AppStateInner { db, redis, config }),
        }
    }

    /// Access the Postgres connection pool.
    pub fn db(&self) -> &PgPool {
        &self.inner.db
    }

    /// Access the Redis connection pool (used for rate limiting).
    pub fn redis(&self) -> &RedisPool {
        &self.inner.redis
    }

    /// Access application configuration.
    pub fn config(&self) -> &Config {
        &self.inner.config
    }
}
