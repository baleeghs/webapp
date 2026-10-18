//! Serves the built web app at `/` with client-side routing fallback: any GET that matches
//! neither an API route nor a file returns `index.html`, so deep links like `/notes/123` work on
//! reload. API routes are registered first, and `/api/*` misses are JSON 404s (`server.rs`), so
//! the UI can never shadow the API.

use std::path::{Path, PathBuf};

use actix_files::{Files, NamedFile};
use actix_web::{
    dev::{ServiceRequest, ServiceResponse, fn_service},
    web,
};

/// The folder to serve, if it holds a web build (`index.html`); `None` means API only.
pub(crate) fn ui_dir(configured: Option<&Path>) -> Option<PathBuf> {
    let dir = configured.filter(|d| !d.as_os_str().is_empty())?;
    dir.join("index.html").is_file().then(|| dir.to_path_buf())
}

pub(crate) fn configure(dir: &Path) -> impl FnOnce(&mut web::ServiceConfig) + use<> {
    let dir = dir.to_path_buf();
    move |cfg| {
        let index: PathBuf = dir.join("index.html");
        cfg.service(Files::new("/", &dir).index_file("index.html").default_handler(fn_service(
            move |req: ServiceRequest| {
                let index = index.clone();
                async move {
                    let (req, _) = req.into_parts();
                    let file = NamedFile::open(&index)?;
                    let res = file.into_response(&req);
                    Ok(ServiceResponse::new(req, res))
                }
            },
        )));
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use actix_web::{App, http::StatusCode, test};
    use app_core::notes::{InMemoryNoteRepository, NoteService};

    use crate::{AppState, routes};

    #[actix_web::test]
    async fn serves_files_falls_back_to_index_and_keeps_api_404s() {
        let dir = std::env::temp_dir().join(format!("app-spa-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("assets")).unwrap();
        std::fs::write(dir.join("index.html"), "<!doctype html><title>spa</title>").unwrap();
        std::fs::write(dir.join("assets/app.js"), "console.log(1)").unwrap();

        let state = AppState {
            notes: Arc::new(NoteService::new(Arc::new(InMemoryNoteRepository::default()))),
            health_checks: Vec::new(),
            metrics: None,
            json_limit_bytes: 1024,
        };
        let app = test::init_service(App::new().configure(routes(state)).configure(super::configure(&dir))).await;

        // The home route serves the app shell.
        let res = test::call_service(&app, test::TestRequest::get().uri("/").to_request()).await;
        assert_eq!(res.status(), StatusCode::OK);
        assert!(test::read_body(res).await.starts_with(b"<!doctype html>"));

        let body = test::call_and_read_body(&app, test::TestRequest::get().uri("/assets/app.js").to_request()).await;
        assert_eq!(body, "console.log(1)");

        // A client-side route on reload gets the app shell.
        let res = test::call_service(&app, test::TestRequest::get().uri("/notes/123").to_request()).await;
        assert_eq!(res.status(), StatusCode::OK);
        assert!(test::read_body(res).await.starts_with(b"<!doctype html>"));

        // API paths never fall through to the SPA.
        let res = test::call_service(&app, test::TestRequest::get().uri("/api/v1/missing").to_request()).await;
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
        assert_eq!(res.headers().get("content-type").unwrap(), "application/json");

        // The API still answers next to the UI.
        let res = test::call_service(&app, test::TestRequest::get().uri("/api/v1/notes").to_request()).await;
        assert_eq!(res.status(), StatusCode::OK);

        std::fs::remove_dir_all(dir).ok();
    }

    #[actix_web::test]
    async fn serves_ui_only_when_a_build_exists() {
        let dir = std::env::temp_dir().join(format!("app-spa-detect-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(super::ui_dir(Some(&dir)), None, "empty folder: API only");
        std::fs::write(dir.join("index.html"), "<!doctype html>").unwrap();
        assert_eq!(super::ui_dir(Some(&dir)), Some(dir.clone()));
        assert_eq!(super::ui_dir(Some(std::path::Path::new(""))), None, "empty value disables");
        assert_eq!(super::ui_dir(None), None);
        std::fs::remove_dir_all(dir).ok();
    }
}
