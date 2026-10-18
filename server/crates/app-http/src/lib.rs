//! HTTP transport (actix-web).
//!
//! Layout mirrors the feature modules elsewhere: `modules/<feature>/` holds `mod.rs` (routes),
//! `handlers.rs` (thin: extract, call the `app-core` service, map the result) and `dto.rs`
//! (request/response types with OpenAPI schemas). Business rules never live here.
//!
//! [`routes`] wires every endpoint and is what tests mount; [`build_server`] adds the middleware
//! stack, static files and the listener.

pub mod error;
pub mod middleware;
pub mod modules;
pub mod openapi;
mod server;
mod spa;
mod state;

pub use server::{build_server, routes};
pub use state::AppState;
