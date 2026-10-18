//! The one error type every service returns. Transports map it to a status code
//! (`app-http::error`, `app-grpc::error`) using [`CoreError::code`], which is part of the public API.

use std::fmt;

pub type CoreResult<T> = Result<T, CoreError>;

/// A single invalid input field, reported back to the caller as-is.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct FieldError {
    pub field: &'static str,
    pub message: String,
}

impl FieldError {
    pub fn new(field: &'static str, message: impl Into<String>) -> Self {
        Self { field, message: message.into() }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("{entity} {id} not found")]
    NotFound { entity: &'static str, id: String },

    #[error("validation failed")]
    Validation(Vec<FieldError>),

    #[error("{0}")]
    Conflict(String),

    /// A dependency (database, cache, upstream API) is down or timed out; safe to retry.
    #[error("service unavailable: {0}")]
    Unavailable(String),

    /// Anything unexpected. The message is logged, never shown to clients.
    #[error("internal error: {0}")]
    Internal(String),
}

impl CoreError {
    pub fn not_found(entity: &'static str, id: impl fmt::Display) -> Self {
        Self::NotFound { entity, id: id.to_string() }
    }

    pub fn internal(err: impl fmt::Display) -> Self {
        Self::Internal(err.to_string())
    }

    /// Stable, machine-readable code. Clients branch on this, so treat changes as breaking.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound { .. } => "not_found",
            Self::Validation(_) => "validation_failed",
            Self::Conflict(_) => "conflict",
            Self::Unavailable(_) => "unavailable",
            Self::Internal(_) => "internal",
        }
    }

    /// The message safe to return to a client: internal details are replaced.
    pub fn public_message(&self) -> String {
        match self {
            Self::Internal(_) => "An unexpected error occurred.".to_owned(),
            other => other.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn internal_details_are_not_public() {
        let err = CoreError::internal("connection reset by peer at 10.0.0.3");
        assert_eq!(err.code(), "internal");
        assert!(!err.public_message().contains("10.0.0.3"));
    }

    #[test]
    fn not_found_names_the_entity() {
        let err = CoreError::not_found("note", 42);
        assert_eq!(err.public_message(), "note 42 not found");
    }
}
