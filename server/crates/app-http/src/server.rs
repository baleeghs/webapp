use std::io;

use actix_cors::Cors;
use actix_web::{
    App, HttpResponse, HttpServer,
    dev::Server,
    http::header,
    middleware::{Compress, Condition, DefaultHeaders, from_fn},
    web,
};
use app_common::config::HttpConfig;
use tracing_actix_web::TracingLogger;

use crate::{
    AppState,
    error::{ApiError, json_error, path_error, query_error},
    middleware, modules, openapi, spa,
};

/// Every route and extractor setting, without middleware. Tests mount exactly this.
pub fn routes(state: AppState) -> impl FnOnce(&mut web::ServiceConfig) {
    move |cfg| {
        let json = web::JsonConfig::default().limit(state.json_limit_bytes).error_handler(json_error);
        cfg.app_data(web::Data::new(state))
            .app_data(json)
            .app_data(web::QueryConfig::default().error_handler(query_error))
            .app_data(web::PathConfig::default().error_handler(path_error))
            .configure(modules::health::routes)
            .service(
                web::scope("/api")
                    .route("/openapi.json", web::get().to(|| async { web::Json(openapi::spec()) }))
                    .service(
                        web::scope("/v1").configure(modules::notes::routes).default_service(web::to(api_not_found)),
                    )
                    .default_service(web::to(api_not_found)),
            );
    }
}

/// Unknown API paths get a JSON 404 instead of falling through to the SPA. Every scope needs it:
/// a nested scope does not inherit its parent's default service.
async fn api_not_found() -> Result<HttpResponse, ApiError> {
    Err(ApiError::not_found_route())
}

/// Builds the server with the full middleware stack. Signals are handled by the caller, which
/// stops the returned server via its handle for a coordinated HTTP + gRPC shutdown.
pub fn build_server(config: &HttpConfig, state: AppState) -> io::Result<Server> {
    let cors_origins = config.cors_origins.clone();
    let static_dir = spa::ui_dir(config.static_dir.as_deref());
    let serving_ui = static_dir.clone();

    let mut server = HttpServer::new(move || {
        let cors = cors_origins
            .iter()
            .fold(Cors::default(), |cors, origin| cors.allowed_origin(origin))
            .allow_any_method()
            .allow_any_header()
            .expose_headers([header::LOCATION, header::HeaderName::from_static("x-request-id")])
            .max_age(3600);
        let security_headers = DefaultHeaders::new()
            .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
            .add((header::X_FRAME_OPTIONS, "DENY"))
            .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin"));

        // `wrap` order: the last one added runs first. Requests flow
        // TracingLogger → request_id → metrics → CORS → cache headers → security headers →
        // compression → handler.
        let app = App::new()
            .wrap(Compress::default())
            .wrap(security_headers)
            .wrap(Condition::new(static_dir.is_some(), from_fn(middleware::static_cache_headers)))
            .wrap(Condition::new(!cors_origins.is_empty(), cors))
            .wrap(from_fn(middleware::metrics))
            .wrap(from_fn(middleware::request_id))
            .wrap(TracingLogger::default())
            .configure(routes(state.clone()));
        match &static_dir {
            Some(dir) => app.configure(spa::configure(dir)),
            None => app,
        }
    })
    .disable_signals()
    .shutdown_timeout(30);

    if config.workers > 0 {
        server = server.workers(config.workers);
    }
    let server = server.bind(config.addr())?;
    if let Some(dir) = &serving_ui {
        tracing::info!(addr = %config.addr(), ui = %dir.display(), "HTTP server listening, serving the web app at /");
    } else {
        tracing::info!(
            addr = %config.addr(),
            static_dir = ?config.static_dir,
            "HTTP server listening, API only: no web build found (run `make build-web`, or `make dev` for the Vite dev server)"
        );
    }
    Ok(server.run())
}
