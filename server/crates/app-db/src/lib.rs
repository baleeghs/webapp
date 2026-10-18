//! Postgres adapters: the connection pool, migrations and one repository per feature.
//!
//! Queries use the runtime-checked `sqlx::query_as` API with `FromRow` row structs, so the crate
//! builds without a live database. Rows are converted to domain types at this boundary; nothing
//! sqlx-specific leaks into `app-core`.

mod error;
mod health;
mod notes;
mod pool;

pub use health::PgHealthCheck;
pub use notes::PgNoteRepository;
pub use pool::{connect, connect_lazy, migrate};
pub use sqlx::PgPool;

/// Migrations from `server/migrations`, embedded at compile time.
pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("../../migrations");
