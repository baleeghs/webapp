//! Readiness checks. Each adapter that the app cannot serve without (database, upstream APIs)
//! implements [`HealthCheck`]; `/readyz` and the gRPC health service run them all.

use async_trait::async_trait;

#[async_trait]
pub trait HealthCheck: Send + Sync {
    /// Short, stable component name shown in the readiness report, e.g. `"database"`.
    fn name(&self) -> &'static str;

    /// `Err` carries a human-readable reason. Implementations should time out quickly.
    async fn check(&self) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct ComponentStatus {
    pub name: &'static str,
    pub healthy: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Runs every check in order; checks are expected to be cheap and bounded by their own timeouts.
pub async fn run_checks(checks: &[std::sync::Arc<dyn HealthCheck>]) -> Vec<ComponentStatus> {
    let mut out = Vec::with_capacity(checks.len());
    for check in checks {
        let result = check.check().await;
        out.push(ComponentStatus { name: check.name(), healthy: result.is_ok(), error: result.err() });
    }
    out
}
