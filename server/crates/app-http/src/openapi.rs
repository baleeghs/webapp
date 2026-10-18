//! The OpenAPI document, derived from the handler and DTO annotations. The committed copy at
//! `server/openapi.yaml` is what the web app generates its client types from; a test fails when it
//! is stale. Regenerate with `make gen-api`.

use utoipa::OpenApi;

use crate::{error, modules};

#[derive(Debug, OpenApi)]
#[openapi(
    info(title = "App API", description = "HTTP API of the app. Errors use the `ErrorBody` envelope."),
    paths(
        modules::health::handlers::liveness,
        modules::health::handlers::readiness,
        modules::notes::handlers::list_notes,
        modules::notes::handlers::get_note,
        modules::notes::handlers::create_note,
        modules::notes::handlers::update_note,
        modules::notes::handlers::delete_note,
    ),
    components(schemas(error::ErrorBody, error::ErrorDetail, error::FieldErrorDto)),
    tags(
        (name = "system", description = "Health and readiness probes"),
        (name = "notes", description = "Example CRUD resource"),
    )
)]
pub struct ApiDoc;

pub fn spec() -> utoipa::openapi::OpenApi {
    let mut doc = ApiDoc::openapi();
    // utoipa copies the crate's (unset) license; set `license` in Cargo.toml to publish one.
    if doc.info.license.as_ref().is_some_and(|l| l.name.is_empty()) {
        doc.info.license = None;
    }
    doc
}

pub fn spec_yaml() -> String {
    spec().to_yaml().expect("OpenAPI document serialises to YAML")
}
