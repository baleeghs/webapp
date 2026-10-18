//! Domain layer: models, business rules, services and the ports (traits) that adapters implement.
//!
//! This crate does no I/O. Transport crates (`app-http`, `app-grpc`) call the services here, and
//! storage crates (`app-db`, `app-cache`) implement the repository traits. Every feature lives in
//! its own module with the same shape as [`notes`]: `model.rs`, `repository.rs`, `service.rs`.

pub mod error;
pub mod health;
pub mod notes;
pub mod pagination;

pub use error::{CoreError, CoreResult, FieldError};
pub use pagination::{Page, PageRequest};
