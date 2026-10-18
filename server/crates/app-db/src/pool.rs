use app_common::config::DatabaseConfig;
use sqlx::{PgPool, postgres::PgPoolOptions};

fn options(config: &DatabaseConfig) -> PgPoolOptions {
    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(config.acquire_timeout())
}

/// Opens the pool and verifies one connection. Used by `migrate`, which needs the database now.
pub async fn connect(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    options(config).connect(&config.url).await
}

/// Creates the pool without connecting; connections open on first use. The server uses this so
/// it can start (and report not-ready on `/readyz`) while the database is down, then recover on
/// its own when it comes back. Fails only on a malformed URL.
pub fn connect_lazy(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    options(config).connect_lazy(&config.url)
}

/// Applies pending migrations. Safe to run concurrently: sqlx takes an advisory lock.
pub async fn migrate(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    crate::MIGRATOR.run(pool).await
}
