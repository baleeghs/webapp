use actix_web::dev::ServerHandle;
use tokio::sync::watch;

/// One shutdown signal shared by both servers. Triggering is idempotent, so a failing server can
/// trigger it to stop the other one too.
#[derive(Clone)]
pub struct Shutdown {
    tx: watch::Sender<bool>,
    http: ServerHandle,
}

impl Shutdown {
    pub fn new(http: ServerHandle) -> Self {
        Self { tx: watch::Sender::new(false), http }
    }

    pub async fn trigger(&self) {
        if !self.tx.send_replace(true) {
            tracing::info!("shutting down");
        }
        self.http.stop(true).await;
    }

    /// Resolves once [`Shutdown::trigger`] has been called.
    pub fn wait(&self) -> impl Future<Output = ()> + Send + 'static {
        let mut rx = self.tx.subscribe();
        async move {
            let _ = rx.wait_for(|stopped| *stopped).await;
        }
    }
}

/// Resolves on Ctrl-C or, on Unix, SIGTERM (what Kubernetes and Docker send).
pub async fn signal() {
    let ctrl_c = async {
        if let Err(err) = tokio::signal::ctrl_c().await {
            tracing::error!(%err, "failed to listen for Ctrl-C");
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(err) => {
                tracing::error!(%err, "failed to listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
    tracing::info!("shutdown signal received");
}
