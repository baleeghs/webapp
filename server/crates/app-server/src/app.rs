use std::sync::Arc;

use anyhow::Context;
use app_cache::{CachedNoteRepository, TtlCache};
use app_common::{AppConfig, telemetry};
use app_core::{
    health::HealthCheck,
    notes::{InMemoryNoteRepository, NoteService},
};
use app_db::{PgHealthCheck, PgNoteRepository, PgPool};
use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};

use crate::{
    cli::ConfigOverrides,
    shutdown::{self, Shutdown},
};

/// Feature services, built once and shared by both transports. Add new services here.
struct Services {
    notes: Arc<NoteService>,
}

/// Where data lives: Postgres when `DATABASE_URL` is set, otherwise process memory.
enum Storage {
    Postgres(PgPool),
    Memory,
}

impl Storage {
    fn services(&self, config: &AppConfig) -> Services {
        match self {
            Self::Postgres(pool) => {
                let notes_repo = CachedNoteRepository::new(
                    PgNoteRepository::new(pool.clone()),
                    TtlCache::from_config(&config.cache),
                );
                Services { notes: Arc::new(NoteService::new(Arc::new(notes_repo))) }
            }
            Self::Memory => Services { notes: Arc::new(NoteService::new(Arc::new(InMemoryNoteRepository::default()))) },
        }
    }

    fn health_checks(&self) -> Vec<Arc<dyn HealthCheck>> {
        match self {
            Self::Postgres(pool) => vec![Arc::new(PgHealthCheck::new(pool.clone()))],
            Self::Memory => Vec::new(),
        }
    }

    async fn close(self) {
        if let Self::Postgres(pool) = self {
            pool.close().await;
        }
    }
}

/// Opens storage without requiring the database to be up: the pool connects lazily, so the
/// server starts, `/readyz` reports the database as unavailable, and requests that need it get
/// `503 unavailable` until it is reachable.
async fn open_storage(config: &AppConfig) -> anyhow::Result<Storage> {
    if !config.database.is_configured() {
        tracing::warn!("DATABASE_URL is not set: using in-memory storage (data is lost on restart)");
        return Ok(Storage::Memory);
    }
    let pool = app_db::connect_lazy(&config.database).context("invalid DATABASE_URL")?;
    if config.database.run_migrations
        && let Err(err) = app_db::migrate(&pool).await
    {
        // In production a deploy must not go live on an unmigrated schema: fail so the
        // orchestrator retries. In development, keep serving and say how to recover.
        if config.is_production() {
            return Err(err).context("running migrations");
        }
        tracing::warn!(
            error = %err,
            "database unreachable or migrations failed; serving anyway (run `make migrate` once it is up)"
        );
    }
    Ok(Storage::Postgres(pool))
}

fn load_config(overrides: &ConfigOverrides) -> anyhow::Result<AppConfig> {
    let config = AppConfig::from_figment(&overrides.apply(AppConfig::figment()))?;
    telemetry::init(&config.log);
    tracing::debug!(?config, "configuration loaded");
    Ok(config)
}

fn install_metrics() -> anyhow::Result<PrometheusHandle> {
    const LATENCY_BUCKETS: &[f64] = &[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];
    PrometheusBuilder::new()
        .set_buckets_for_metric(Matcher::Suffix("_duration_seconds".into()), LATENCY_BUCKETS)?
        .install_recorder()
        .context("installing the Prometheus recorder")
}

pub async fn migrate(overrides: &ConfigOverrides) -> anyhow::Result<()> {
    let config = load_config(overrides)?;
    anyhow::ensure!(config.database.is_configured(), "set DATABASE_URL to run migrations");
    let pool =
        app_db::connect(&config.database).await.context("connecting to the database (is DATABASE_URL right?)")?;
    app_db::migrate(&pool).await.context("running migrations")?;
    tracing::info!("migrations applied");
    Ok(())
}

pub async fn serve(overrides: &ConfigOverrides) -> anyhow::Result<()> {
    let config = load_config(overrides)?;
    let metrics = install_metrics()?;

    let storage = open_storage(&config).await?;
    let services = storage.services(&config);
    let result = run(&config, &services, storage.health_checks(), Some(metrics), shutdown::signal()).await;
    storage.close().await;
    tracing::info!("stopped");
    result
}

/// Runs both servers until `stop` resolves or either server fails, then shuts both down.
async fn run(
    config: &AppConfig,
    services: &Services,
    health_checks: Vec<Arc<dyn HealthCheck>>,
    metrics: Option<PrometheusHandle>,
    stop: impl Future<Output = ()> + Send + 'static,
) -> anyhow::Result<()> {
    let http_state = app_http::AppState {
        notes: services.notes.clone(),
        health_checks,
        metrics,
        json_limit_bytes: config.http.json_limit_bytes,
    };
    let http = app_http::build_server(&config.http, http_state).with_context(|| {
        format!("starting the HTTP server on {} (port in use? use --http-port or APP_HTTP__PORT)", config.http.addr())
    })?;
    let shutdown = Shutdown::new(http.handle());

    tokio::spawn({
        let shutdown = shutdown.clone();
        async move {
            stop.await;
            shutdown.trigger().await;
        }
    });

    let http_task = async {
        let result = http.await.context("HTTP server");
        shutdown.trigger().await;
        result
    };
    let grpc_task = async {
        if !config.grpc.enabled {
            return Ok(());
        }
        let state = app_grpc::GrpcState { notes: services.notes.clone() };
        let result = app_grpc::serve(&config.grpc, state, shutdown.wait()).await.with_context(|| {
            format!(
                "gRPC server on {}:{} (port in use? use --grpc-port or APP_GRPC__PORT, or APP_GRPC__ENABLED=false)",
                config.grpc.host, config.grpc.port
            )
        });
        shutdown.trigger().await;
        result
    };
    let (http_result, grpc_result) = tokio::join!(http_task, grpc_task);
    http_result.and(grpc_result)
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use app_core::notes::InMemoryNoteRepository;
    use app_proto::app::v1::{CreateNoteRequest, note_service_client::NoteServiceClient};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    use super::*;

    fn free_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
    }

    async fn http_get(port: u16, path: &str) -> String {
        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        let req = format!("GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
        stream.write_all(req.as_bytes()).await.unwrap();
        let mut out = String::new();
        stream.read_to_string(&mut out).await.unwrap();
        out
    }

    /// Boots the real HTTP + gRPC servers (in-memory storage), talks to both, then shuts down.
    #[tokio::test]
    async fn both_servers_serve_and_shut_down_cleanly() {
        let mut config = AppConfig::default();
        config.http.host = "127.0.0.1".into();
        config.http.port = free_port();
        config.http.workers = 1;
        config.grpc.host = "127.0.0.1".into();
        config.grpc.port = free_port();
        let services = Services { notes: Arc::new(NoteService::new(Arc::new(InMemoryNoteRepository::default()))) };
        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();

        let (http_port, grpc_port) = (config.http.port, config.grpc.port);
        let server = tokio::spawn(async move {
            run(&config, &services, Vec::new(), None, async {
                let _ = stop_rx.await;
            })
            .await
        });
        tokio::time::sleep(Duration::from_millis(300)).await;

        let mut grpc = NoteServiceClient::connect(format!("http://127.0.0.1:{grpc_port}")).await.unwrap();
        let note = grpc
            .create_note(CreateNoteRequest { title: "via gRPC".into(), body: String::new() })
            .await
            .unwrap()
            .into_inner();

        // Both transports share one service: a note created over gRPC is visible over HTTP.
        let res = http_get(http_port, &format!("/api/v1/notes/{}", note.id)).await;
        assert!(res.starts_with("HTTP/1.1 200"), "{res}");
        assert!(res.contains("via gRPC"));
        assert!(res.to_ascii_lowercase().contains("x-request-id"));

        stop_tx.send(()).unwrap();
        let result = tokio::time::timeout(Duration::from_secs(10), server).await.expect("shuts down in time");
        result.unwrap().unwrap();
    }
}
