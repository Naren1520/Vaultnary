use crate::config::Config;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    pub db: PgPool,
    pub config: Config,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> Self {
        Self {
            inner: Arc::new(AppStateInner { db, config }),
        }
    }

    pub fn db(&self) -> &PgPool {
        &self.inner.db
    }

    pub fn config(&self) -> &Config {
        &self.inner.config
    }
}
