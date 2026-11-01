mod bootstrap;
mod config;
mod email;
mod error;
mod middleware;
mod routes;
mod state;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    bootstrap::run().await
}
