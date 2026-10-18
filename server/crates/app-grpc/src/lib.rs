//! gRPC transport (tonic). One module per proto service; each adapts requests to an `app-core`
//! service and maps [`app_core::CoreError`] to a [`tonic::Status`] via [`error::status`].
//! Also serves the standard health service and, when enabled, server reflection.

mod error;
mod notes;

use std::{future::Future, sync::Arc};

use app_common::config::GrpcConfig;
use app_core::notes::NoteService;
use app_proto::app::v1::note_service_server::NoteServiceServer;
use tonic::transport::Server;

pub use notes::GrpcNoteService;

/// Everything the gRPC server needs from the composition root.
#[derive(Debug, Clone)]
pub struct GrpcState {
    pub notes: Arc<NoteService>,
}

#[derive(Debug, thiserror::Error)]
pub enum GrpcError {
    #[error(transparent)]
    Config(#[from] app_common::ConfigError),
    #[error(transparent)]
    Transport(#[from] tonic::transport::Error),
    #[error(transparent)]
    Reflection(#[from] tonic_reflection::server::Error),
}

/// Serves until `shutdown` resolves, then drains in-flight calls.
pub async fn serve(
    config: &GrpcConfig,
    state: GrpcState,
    shutdown: impl Future<Output = ()> + Send,
) -> Result<(), GrpcError> {
    let addr = config.addr()?;

    let (health_reporter, health_service) = tonic_health::server::health_reporter();
    health_reporter.set_serving::<NoteServiceServer<GrpcNoteService>>().await;

    let reflection = if config.reflection {
        Some(
            tonic_reflection::server::Builder::configure()
                .register_encoded_file_descriptor_set(app_proto::FILE_DESCRIPTOR_SET)
                .build_v1()?,
        )
    } else {
        None
    };

    tracing::info!(%addr, reflection = config.reflection, "gRPC server listening");
    Server::builder()
        .trace_fn(|req| tracing::info_span!("grpc", method = %req.uri().path()))
        .add_service(health_service)
        .add_optional_service(reflection)
        .add_service(NoteServiceServer::new(GrpcNoteService::new(state.notes)))
        .serve_with_shutdown(addr, shutdown)
        .await?;
    tracing::info!("gRPC server stopped");
    Ok(())
}
