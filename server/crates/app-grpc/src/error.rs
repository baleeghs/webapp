use app_core::CoreError;
use tonic::{Code, Status};

/// Maps a domain error to a gRPC status. Internal details are logged, never sent.
/// Takes the error by value so it can be passed straight to `map_err`.
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn status(err: CoreError) -> Status {
    // Exhaustive on purpose: a new CoreError variant must choose its gRPC code here.
    let code = match &err {
        CoreError::NotFound { .. } => Code::NotFound,
        CoreError::Validation(_) => Code::InvalidArgument,
        CoreError::Conflict(_) => Code::AlreadyExists,
        CoreError::Unavailable(_) => Code::Unavailable,
        CoreError::Internal(detail) => {
            tracing::error!(error = %detail, "internal error");
            Code::Internal
        }
    };
    let message = match &err {
        CoreError::Validation(fields) => {
            fields.iter().map(|f| format!("{}: {}", f.field, f.message)).collect::<Vec<_>>().join("; ")
        }
        other => other.public_message(),
    };
    Status::new(code, message)
}

pub(crate) fn parse_id(id: &str) -> Result<uuid::Uuid, Status> {
    id.parse().map_err(|_| Status::invalid_argument(format!("id: {id:?} is not a valid UUID")))
}
