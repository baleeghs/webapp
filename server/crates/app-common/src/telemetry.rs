//! Tracing setup. Call [`init`] once, first thing in `main`.

use tracing_subscriber::{EnvFilter, fmt, prelude::*};

use crate::config::{LogConfig, LogFormat};

/// Installs the global subscriber. `RUST_LOG`, when set, overrides `config.filter`.
pub fn init(config: &LogConfig) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(&config.filter));
    let registry = tracing_subscriber::registry().with(filter);
    match config.format {
        LogFormat::Json => registry.with(fmt::layer().json().flatten_event(true).with_current_span(true)).init(),
        LogFormat::Pretty => registry.with(fmt::layer().with_target(true)).init(),
    }
}
