use std::sync::Arc;

use app_core::{health::HealthCheck, notes::NoteService};
use metrics_exporter_prometheus::PrometheusHandle;

/// Shared, cheaply cloned state handed to every handler as `web::Data<AppState>`.
/// Add one field per feature service.
#[derive(Clone)]
pub struct AppState {
    pub notes: Arc<NoteService>,
    pub health_checks: Vec<Arc<dyn HealthCheck>>,
    /// `None` disables `/metrics` (tests, or when another exporter is used).
    pub metrics: Option<PrometheusHandle>,
    pub json_limit_bytes: usize,
}

impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppState")
            .field("health_checks", &self.health_checks.iter().map(|c| c.name()).collect::<Vec<_>>())
            .field("metrics", &self.metrics.is_some())
            .finish_non_exhaustive()
    }
}
