//! Middleware written with `actix_web::middleware::from_fn`. Order is set in `server.rs`.

use std::time::Instant;

use actix_web::{
    Error, HttpMessage,
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    http::header::{self, HeaderName, HeaderValue},
    middleware::Next,
};
use tracing_actix_web::RequestId;

const X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

/// Echoes the request id that `TracingLogger` attached to the request span as `x-request-id`, so
/// a client-reported error can be matched to server logs. Must run inside `TracingLogger`.
pub async fn request_id(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let id = req.extensions().get::<RequestId>().copied();
    let mut res = next.call(req).await?;
    if let Some(value) = id.and_then(|id| HeaderValue::from_str(&id.to_string()).ok()) {
        res.headers_mut().insert(X_REQUEST_ID, value);
    }
    Ok(res)
}

/// Records `http_requests_total` and `http_request_duration_seconds`, labelled by the matched route
/// pattern (`/api/v1/notes/{id}`), never the raw path, to keep label cardinality bounded.
pub async fn metrics(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let start = Instant::now();
    let method = req.method().to_string();
    let res = next.call(req).await?;
    let route = res.request().match_pattern().unwrap_or_else(|| "unmatched".to_owned());
    let status = res.status().as_u16().to_string();
    metrics::counter!("http_requests_total", "method" => method.clone(), "route" => route.clone(), "status" => status)
        .increment(1);
    metrics::histogram!("http_request_duration_seconds", "method" => method, "route" => route)
        .record(start.elapsed().as_secs_f64());
    Ok(res)
}

/// Long-lived caching for content-hashed build assets; revalidation for everything else that is
/// not an API response (so a new deploy's `index.html` is picked up immediately).
pub async fn static_cache_headers(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let path = req.path().to_owned();
    let mut res = next.call(req).await?;
    if !path.starts_with("/api/") && !res.headers().contains_key(header::CACHE_CONTROL) {
        let value = if path.starts_with("/assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
        res.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static(value));
    }
    Ok(res)
}
