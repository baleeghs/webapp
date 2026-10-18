//! The JSON error envelope every endpoint returns, and the mapping from domain errors to HTTP.
//!
//! ```json
//! { "error": { "code": "validation_failed", "message": "validation failed",
//!              "details": [{ "field": "title", "message": "must not be empty" }] } }
//! ```
//! `code` is stable and documented in docs/api/API.md; clients branch on it, not on `message`.

use actix_web::{HttpRequest, HttpResponse, ResponseError, http::StatusCode};
use app_core::{CoreError, FieldError};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorDetail {
    /// Stable machine-readable code, e.g. `not_found`, `validation_failed`.
    pub code: String,
    /// Human-readable description; may change between releases.
    pub message: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub details: Vec<FieldErrorDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FieldErrorDto {
    pub field: String,
    pub message: String,
}

/// Handler error type: wraps [`CoreError`] so `?` works on service calls.
#[derive(Debug, thiserror::Error)]
#[error(transparent)]
pub struct ApiError(#[from] pub CoreError);

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    /// A 400 for malformed input caught before reaching a service (bad JSON, query or path).
    pub fn bad_input(field: &'static str, message: impl Into<String>) -> Self {
        Self(CoreError::Validation(vec![FieldError::new(field, message)]))
    }

    pub fn not_found_route() -> Self {
        Self(CoreError::NotFound { entity: "route", id: String::new() })
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        // Exhaustive on purpose: a new CoreError variant must choose its status here.
        match &self.0 {
            CoreError::NotFound { .. } => StatusCode::NOT_FOUND,
            CoreError::Validation(_) => StatusCode::BAD_REQUEST,
            CoreError::Conflict(_) => StatusCode::CONFLICT,
            CoreError::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            CoreError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let CoreError::Internal(detail) = &self.0 {
            tracing::error!(error = %detail, "internal error");
        }
        let details = match &self.0 {
            CoreError::Validation(fields) => {
                fields.iter().map(|f| FieldErrorDto { field: f.field.to_owned(), message: f.message.clone() }).collect()
            }
            _ => Vec::new(),
        };
        let message = match &self.0 {
            CoreError::NotFound { entity: "route", .. } => "No such endpoint.".to_owned(),
            other => other.public_message(),
        };
        HttpResponse::build(self.status_code())
            .json(ErrorBody { error: ErrorDetail { code: self.0.code().to_owned(), message, details } })
    }
}

/// Turns extractor failures (bad JSON, query string or path) into the standard envelope.
/// The signatures are fixed by actix's `error_handler` API.
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn json_error(err: actix_web::error::JsonPayloadError, _: &HttpRequest) -> actix_web::Error {
    ApiError::bad_input("body", err.to_string()).into()
}

#[allow(clippy::needless_pass_by_value)]
pub(crate) fn query_error(err: actix_web::error::QueryPayloadError, _: &HttpRequest) -> actix_web::Error {
    ApiError::bad_input("query", err.to_string()).into()
}

#[allow(clippy::needless_pass_by_value)]
pub(crate) fn path_error(err: actix_web::error::PathError, _: &HttpRequest) -> actix_web::Error {
    ApiError::bad_input("path", err.to_string()).into()
}
