use app_core::CoreError;

/// Maps a sqlx error to a domain error, logging anything the caller will only see as generic.
pub(crate) fn map_err(err: sqlx::Error) -> CoreError {
    match &err {
        sqlx::Error::PoolTimedOut | sqlx::Error::PoolClosed | sqlx::Error::Io(_) => {
            tracing::warn!(error = %err, "database unavailable");
            CoreError::Unavailable("database".into())
        }
        sqlx::Error::Database(db) if db.is_unique_violation() => CoreError::Conflict(
            db.constraint().map_or_else(|| "already exists".into(), |c| format!("{c} already exists")),
        ),
        _ => {
            tracing::error!(error = %err, "database error");
            CoreError::internal(err)
        }
    }
}
