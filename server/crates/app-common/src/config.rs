//! Typed configuration, loaded once at startup from defaults and then the environment.
//!
//! Every field can be set with an `APP_`-prefixed variable; nested fields use `__`:
//! `APP_HTTP__PORT=9000`, `APP_LOG__FORMAT=json`. The binary layers CLI flags on top
//! (`app-server --http-port 9000`, see `app-server/src/cli.rs`). `DATABASE_URL` is also read (the sqlx
//! convention) and wins over `APP_DATABASE__URL`. `.env.example` at the repo root lists them all.
//!
//! No database URL means in-memory storage: the server runs with zero setup, which suits a template
//! and quick experiments. Production refuses to start without one.

use std::{fmt, net::SocketAddr, path::PathBuf, time::Duration};

use figment::{
    Figment,
    providers::{Env, Serialized},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to load configuration: {0}")]
    Load(#[from] Box<figment::Error>),
    #[error("invalid configuration: {0}")]
    Invalid(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    #[default]
    Development,
    Production,
    Test,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    pub env: Environment,
    pub http: HttpConfig,
    pub grpc: GrpcConfig,
    pub database: DatabaseConfig,
    pub cache: CacheConfig,
    pub log: LogConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct HttpConfig {
    pub host: String,
    pub port: u16,
    /// Allowed CORS origins. Empty means same-origin only (the production setup, where the
    /// server also serves the web app).
    pub cors_origins: Vec<String>,
    /// The built web app, served at `/` with client-side-routing fallback. `pnpm build` (or
    /// `make build-web`) writes it to `server/static`, which is this default relative to the
    /// server's working directory. If the folder has no `index.html` the server serves only the
    /// API (and says so in the log); an empty value disables UI serving.
    pub static_dir: Option<PathBuf>,
    /// Upper bound on a JSON request body, in bytes.
    pub json_limit_bytes: usize,
    /// Worker threads; 0 means one per CPU core.
    pub workers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GrpcConfig {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    /// Serve gRPC server reflection (for grpcurl / Postman). Off in production by default.
    pub reflection: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct DatabaseConfig {
    /// Postgres URL. Empty: in-memory storage (development only; data is lost on restart).
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout_secs: u64,
    /// Apply pending migrations at startup. Prefer `app-server migrate` as a deploy step when
    /// several replicas start at once.
    pub run_migrations: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CacheConfig {
    pub ttl_secs: u64,
    pub max_capacity: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    #[default]
    Pretty,
    Json,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LogConfig {
    /// `tracing` filter directive, e.g. `info,app_http=debug,sqlx=warn`. `RUST_LOG` overrides it.
    pub filter: String,
    pub format: LogFormat,
}

impl Default for HttpConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".into(),
            port: 8080,
            cors_origins: Vec::new(),
            static_dir: Some(PathBuf::from("static")),
            json_limit_bytes: 1024 * 1024,
            workers: 0,
        }
    }
}

impl Default for GrpcConfig {
    fn default() -> Self {
        Self { enabled: true, host: "0.0.0.0".into(), port: 50052, reflection: true }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            max_connections: 10,
            min_connections: 1,
            acquire_timeout_secs: 5,
            run_migrations: true,
        }
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self { ttl_secs: 60, max_capacity: 10_000 }
    }
}

impl Default for LogConfig {
    fn default() -> Self {
        Self { filter: "info,sqlx=warn".into(), format: LogFormat::Pretty }
    }
}

/// The URL holds the password, so it is never printed.
impl fmt::Debug for DatabaseConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DatabaseConfig")
            .field("url", &"<redacted>")
            .field("max_connections", &self.max_connections)
            .field("min_connections", &self.min_connections)
            .field("acquire_timeout_secs", &self.acquire_timeout_secs)
            .field("run_migrations", &self.run_migrations)
            .finish()
    }
}

impl AppConfig {
    /// Loads defaults, then `APP_*` variables, then `DATABASE_URL`, and validates the result.
    pub fn load() -> Result<Self, ConfigError> {
        Self::from_figment(&Self::figment())
    }

    pub fn figment() -> Figment {
        Figment::from(Serialized::defaults(Self::default()))
            .merge(Env::prefixed("APP_").split("__"))
            .merge(Env::raw().only(&["DATABASE_URL"]).map(|_| "database.url".into()))
    }

    pub fn from_figment(figment: &Figment) -> Result<Self, ConfigError> {
        let config: Self = figment.extract().map_err(Box::new)?;
        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<(), ConfigError> {
        let invalid = |msg: &str| Err(ConfigError::Invalid(msg.to_owned()));
        if self.is_production() && !self.database.is_configured() {
            return invalid("DATABASE_URL must be set in production (in-memory storage is for development)");
        }
        if self.database.max_connections == 0 || self.database.min_connections > self.database.max_connections {
            return invalid("database pool needs 0 < min_connections <= max_connections");
        }
        if self.grpc.enabled && self.grpc.port == self.http.port && self.grpc.host == self.http.host {
            return invalid("http and grpc cannot listen on the same address");
        }
        if self.env == Environment::Production && self.http.cors_origins.iter().any(|o| o == "*") {
            return invalid("wildcard CORS origin is not allowed in production");
        }
        Ok(())
    }

    pub fn is_production(&self) -> bool {
        self.env == Environment::Production
    }
}

impl HttpConfig {
    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

impl GrpcConfig {
    pub fn addr(&self) -> Result<SocketAddr, ConfigError> {
        format!("{}:{}", self.host, self.port)
            .parse()
            .map_err(|e| ConfigError::Invalid(format!("grpc address {}:{}: {e}", self.host, self.port)))
    }
}

impl DatabaseConfig {
    /// Whether a database URL is set; otherwise the server uses in-memory storage.
    pub fn is_configured(&self) -> bool {
        !self.url.trim().is_empty()
    }

    pub fn acquire_timeout(&self) -> Duration {
        Duration::from_secs(self.acquire_timeout_secs)
    }
}

impl CacheConfig {
    pub fn ttl(&self) -> Duration {
        Duration::from_secs(self.ttl_secs)
    }
}

#[cfg(test)]
#[allow(clippy::result_large_err)] // figment::Jail closures return figment::Error.
mod tests {
    // Every test runs in a `Jail` that starts with an empty environment (`clear_env`), so variables
    // from the shell or CI (CI sets DATABASE_URL for the Postgres tests) cannot change the result.
    use figment::Jail;

    use super::*;

    #[test]
    fn defaults_are_valid() {
        Jail::expect_with(|jail| {
            jail.clear_env();
            let config = AppConfig::load().expect("defaults load");
            assert_eq!(config.http.port, 8080);
            assert_eq!(config.env, Environment::Development);
            Ok(())
        });
    }

    #[test]
    fn env_overrides_nested_fields() {
        Jail::expect_with(|jail| {
            jail.clear_env();
            jail.set_env("APP_HTTP__PORT", "9000");
            jail.set_env("APP_LOG__FORMAT", "json");
            jail.set_env("DATABASE_URL", "postgres://u:p@db/x");
            let config = AppConfig::load().expect("config loads");
            assert_eq!(config.http.port, 9000);
            assert_eq!(config.log.format, LogFormat::Json);
            assert_eq!(config.database.url, "postgres://u:p@db/x");
            Ok(())
        });
    }

    #[test]
    fn database_url_is_redacted_in_debug() {
        let config = DatabaseConfig { url: "postgres://app:secret@db/app".into(), ..DatabaseConfig::default() };
        assert!(!format!("{config:?}").contains("secret"));
    }

    #[test]
    fn database_is_optional_except_in_production() {
        Jail::expect_with(|jail| {
            jail.clear_env();
            assert!(!AppConfig::load().expect("loads without a database").database.is_configured());
            jail.set_env("APP_ENV", "production");
            assert!(matches!(AppConfig::load(), Err(ConfigError::Invalid(_))));
            jail.set_env("DATABASE_URL", "postgres://u:p@db/x");
            assert!(AppConfig::load().is_ok());
            Ok(())
        });
    }

    #[test]
    fn production_rejects_wildcard_cors() {
        Jail::expect_with(|jail| {
            jail.clear_env();
            jail.set_env("APP_ENV", "production");
            jail.set_env("DATABASE_URL", "postgres://u:p@db/x");
            jail.set_env("APP_HTTP__CORS_ORIGINS", "[\"*\"]");
            assert!(matches!(AppConfig::load(), Err(ConfigError::Invalid(_))));
            Ok(())
        });
    }
}
