use actix_web::{HttpResponse, Responder, web};
use app_core::health::run_checks;

use super::dto::{ComponentDto, HealthResponse};
use crate::AppState;

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Liveness: always 200 while the process can serve requests.
#[utoipa::path(get, path = "/healthz", tag = "system", responses((status = 200, description = "Success", body = HealthResponse)))]
pub async fn liveness() -> impl Responder {
    web::Json(HealthResponse { status: "ok", version: VERSION, components: Vec::new() })
}

/// Readiness: 200 when every dependency answers, 503 otherwise (with the failing components).
#[utoipa::path(
    get,
    path = "/readyz",
    tag = "system",
    responses((status = 200, description = "Success", body = HealthResponse), (status = 503, description = "A dependency is unavailable", body = HealthResponse))
)]
pub async fn readiness(state: web::Data<AppState>) -> HttpResponse {
    let components: Vec<_> = run_checks(&state.health_checks)
        .await
        .into_iter()
        .map(|c| ComponentDto { name: c.name, healthy: c.healthy, error: c.error })
        .collect();
    let ready = components.iter().all(|c| c.healthy);
    let body = HealthResponse { status: if ready { "ok" } else { "unavailable" }, version: VERSION, components };
    if ready { HttpResponse::Ok().json(body) } else { HttpResponse::ServiceUnavailable().json(body) }
}

pub async fn metrics(state: web::Data<AppState>) -> HttpResponse {
    match &state.metrics {
        Some(handle) => HttpResponse::Ok().content_type("text/plain; version=0.0.4").body(handle.render()),
        None => HttpResponse::NotFound().finish(),
    }
}
