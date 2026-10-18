//! `/api/v1/notes`: the example CRUD resource. Copy this module for new features.

pub mod dto;
pub mod handlers;

use actix_web::web;

/// Mounted under `/api/v1` by `server::routes`.
pub fn routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/notes").route(web::get().to(handlers::list_notes)).route(web::post().to(handlers::create_note)),
    )
    .service(
        web::resource("/notes/{id}")
            .route(web::get().to(handlers::get_note))
            .route(web::patch().to(handlers::update_note))
            .route(web::delete().to(handlers::delete_note)),
    );
}
