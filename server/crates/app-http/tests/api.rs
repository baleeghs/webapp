//! HTTP-level tests against the real routes with an in-memory repository: status codes, the error
//! envelope and JSON shapes, i.e. the contract the web app relies on.

use std::sync::Arc;

use actix_web::{
    App,
    http::{StatusCode, header},
    middleware::from_fn,
    test,
};
use app_core::{
    health::HealthCheck,
    notes::{InMemoryNoteRepository, NoteService},
};
use app_http::{AppState, routes};
use serde_json::{Value, json};

struct Failing;

#[async_trait::async_trait]
impl HealthCheck for Failing {
    fn name(&self) -> &'static str {
        "database"
    }
    async fn check(&self) -> Result<(), String> {
        Err("connection refused".into())
    }
}

fn state() -> AppState {
    AppState {
        notes: Arc::new(NoteService::new(Arc::new(InMemoryNoteRepository::default()))),
        health_checks: Vec::new(),
        metrics: None,
        json_limit_bytes: 64 * 1024,
    }
}

macro_rules! app {
    ($state:expr) => {
        test::init_service(App::new().configure(routes($state))).await
    };
}

#[actix_web::test]
async fn notes_crud() {
    let app = app!(state());

    let req = test::TestRequest::post().uri("/api/v1/notes").set_json(json!({"title": " First ", "body": "b"}));
    let res = test::call_service(&app, req.to_request()).await;
    assert_eq!(res.status(), StatusCode::CREATED);
    let location = res.headers().get(header::LOCATION).unwrap().to_str().unwrap().to_owned();
    let created: Value = test::read_body_json(res).await;
    assert_eq!(created["title"], "First");
    assert!(created["createdAt"].is_string(), "fields are camelCase");
    assert_eq!(location, format!("/api/v1/notes/{}", created["id"].as_str().unwrap()));

    let req = test::TestRequest::patch().uri(&location).set_json(json!({"body": "changed"}));
    let updated: Value = test::call_and_read_body_json(&app, req.to_request()).await;
    assert_eq!(updated["body"], "changed");
    assert_eq!(updated["title"], "First");

    let page: Value =
        test::call_and_read_body_json(&app, test::TestRequest::get().uri("/api/v1/notes").to_request()).await;
    assert_eq!(page["total"], 1);
    assert_eq!(page["limit"], 20);

    let res = test::call_service(&app, test::TestRequest::delete().uri(&location).to_request()).await;
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    let res = test::call_service(&app, test::TestRequest::get().uri(&location).to_request()).await;
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[actix_web::test]
async fn validation_errors_use_the_envelope() {
    let app = app!(state());
    let req = test::TestRequest::post().uri("/api/v1/notes").set_json(json!({"title": ""}));
    let res = test::call_service(&app, req.to_request()).await;
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body: Value = test::read_body_json(res).await;
    assert_eq!(body["error"]["code"], "validation_failed");
    assert_eq!(body["error"]["details"][0]["field"], "title");
}

#[actix_web::test]
async fn malformed_input_is_a_400_envelope() {
    let app = app!(state());
    let cases = [
        test::TestRequest::post()
            .uri("/api/v1/notes")
            .set_payload("{not json")
            .insert_header(header::ContentType::json()),
        test::TestRequest::post().uri("/api/v1/notes").set_json(json!({"title": "x", "unknown": 1})),
        test::TestRequest::get().uri("/api/v1/notes/not-a-uuid"),
        test::TestRequest::get().uri("/api/v1/notes?limit=abc"),
    ];
    for req in cases {
        let res = test::call_service(&app, req.to_request()).await;
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
        let body: Value = test::read_body_json(res).await;
        assert_eq!(body["error"]["code"], "validation_failed");
    }
}

#[actix_web::test]
async fn unknown_api_route_is_a_json_404() {
    let app = app!(state());
    let res = test::call_service(&app, test::TestRequest::get().uri("/api/v1/nope").to_request()).await;
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let body: Value = test::read_body_json(res).await;
    assert_eq!(body["error"]["code"], "not_found");
}

#[actix_web::test]
async fn readiness_reports_failing_components() {
    let app = app!(AppState { health_checks: vec![Arc::new(Failing)], ..state() });
    let res = test::call_service(&app, test::TestRequest::get().uri("/healthz").to_request()).await;
    assert_eq!(res.status(), StatusCode::OK);

    let res = test::call_service(&app, test::TestRequest::get().uri("/readyz").to_request()).await;
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body: Value = test::read_body_json(res).await;
    assert_eq!(body["components"][0]["name"], "database");
    assert_eq!(body["components"][0]["healthy"], false);
}

#[actix_web::test]
async fn responses_carry_a_request_id() {
    let app = test::init_service(
        App::new()
            .wrap(from_fn(app_http::middleware::request_id))
            .wrap(tracing_actix_web::TracingLogger::default())
            .configure(routes(state())),
    )
    .await;
    let res = test::call_service(&app, test::TestRequest::get().uri("/healthz").to_request()).await;
    assert!(res.headers().contains_key("x-request-id"));
}

#[actix_web::test]
async fn openapi_document_is_served() {
    let app = app!(state());
    let doc: Value =
        test::call_and_read_body_json(&app, test::TestRequest::get().uri("/api/openapi.json").to_request()).await;
    assert!(doc["paths"]["/api/v1/notes"].is_object());
}
