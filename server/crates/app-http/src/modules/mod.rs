//! One module per feature. To add a feature: create `modules/<feature>/` like `notes`, call its
//! `routes` from `server::routes`, and list its handlers and DTOs in `openapi::ApiDoc`.

pub mod health;
pub mod notes;
