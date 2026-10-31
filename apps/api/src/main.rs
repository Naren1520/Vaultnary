mod bootstrap;
mod config;
mod error;
mod middleware;
mod routes;
mod state;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    bootstrap::run().await
}
