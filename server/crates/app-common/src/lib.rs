//! Cross-cutting infrastructure shared by every crate: configuration and telemetry.
//! Nothing domain-specific belongs here.

pub mod config;
pub mod telemetry;

pub use config::{AppConfig, ConfigError};
