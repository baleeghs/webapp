//! Probes and metrics, served at the root (not under `/api`) for load balancers and Kubernetes:
//! `/healthz` (liveness: the process is up), `/readyz` (readiness: dependencies answer) and
//! `/metrics` (Prometheus text format).

pub mod dto;
pub mod handlers;

use actix_web::web;

pub fn routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/healthz", web::get().to(handlers::liveness))
        .route("/readyz", web::get().to(handlers::readiness))
        .route("/metrics", web::get().to(handlers::metrics));
}
