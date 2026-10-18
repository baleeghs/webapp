//! The binary and composition root: loads config, builds adapters and services, and runs the HTTP
//! and gRPC servers side by side with one coordinated graceful shutdown.

mod app;
mod cli;
mod shutdown;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // A missing .env is fine (production uses real environment variables).
    let _ = dotenvy::dotenv();
    let cli = cli::Cli::parse();
    match cli.command.unwrap_or_default() {
        cli::Command::Serve => app::serve(&cli.overrides).await,
        cli::Command::Migrate => app::migrate(&cli.overrides).await,
        cli::Command::Openapi => {
            #[allow(clippy::print_stdout)] // Output is the product: `app-server openapi > openapi.yaml`.
            {
                print!("{}", app_http::openapi::spec_yaml());
            }
            Ok(())
        }
    }
}
