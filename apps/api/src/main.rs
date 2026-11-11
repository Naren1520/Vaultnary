mod bootstrap;
mod config;
mod email;
mod email_outbox;
mod error;
mod middleware;
mod routes;
mod state;
mod time_format;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    bootstrap::run().await
}
