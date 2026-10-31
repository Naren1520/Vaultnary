use std::env;

/// Application configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub port: u16,
    pub session_secret: String,
    pub log_format: LogFormat,
    pub app_env: AppEnv,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    Json,
    Human,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppEnv {
    Development,
    Production,
}

impl Config {
    /// Load configuration from environment variables.
    /// Panics if required variables are missing.
    pub fn from_env() -> Self {
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set");
        
        let redis_url = env::var("REDIS_URL")
            .expect("REDIS_URL must be set");
        
        let port = env::var("PORT")
            .expect("PORT must be set")
            .parse::<u16>()
            .expect("PORT must be a valid u16");
        
        let session_secret = env::var("SESSION_SECRET")
            .expect("SESSION_SECRET must be set");
        
        let log_format = match env::var("LOG_FORMAT")
            .unwrap_or_else(|_| "human".to_string())
            .to_lowercase()
            .as_str()
        {
            "json" => LogFormat::Json,
            _ => LogFormat::Human,
        };
        
        let app_env = match env::var("APP_ENV")
            .unwrap_or_else(|_| "development".to_string())
            .to_lowercase()
            .as_str()
        {
            "production" | "prod" => AppEnv::Production,
            _ => AppEnv::Development,
        };

        Self {
            database_url,
            redis_url,
            port,
            session_secret,
            log_format,
            app_env,
        }
    }

    /// Returns true if running in development mode.
    /// Used to conditionally set the Secure attribute on cookies.
    pub fn is_development(&self) -> bool {
        self.app_env == AppEnv::Development
    }
}
