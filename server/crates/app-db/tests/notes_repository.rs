//! Runs against a real Postgres. Ignored by default; run with `make test-db` (needs `DATABASE_URL`).
//! `#[sqlx::test]` creates a fresh database per test and applies the migrations.

use app_core::{
    PageRequest,
    notes::{NewNote, NoteChanges, NoteService},
};
use app_db::PgNoteRepository;
use sqlx::PgPool;
use std::sync::Arc;

fn service(pool: PgPool) -> NoteService {
    NoteService::new(Arc::new(PgNoteRepository::new(pool)))
}

#[sqlx::test(migrator = "app_db::MIGRATOR")]
#[ignore = "needs Postgres: run `make test-db`"]
async fn crud_round_trip(pool: PgPool) {
    let svc = service(pool);
    let note = svc.create(NewNote { title: "hello".into(), body: "world".into() }).await.unwrap();

    let fetched = svc.get(note.id).await.unwrap();
    assert_eq!(fetched.title, "hello");

    let updated = svc.update(note.id, NoteChanges { title: None, body: Some("changed".into()) }).await.unwrap();
    assert_eq!(updated.title, "hello");
    assert_eq!(updated.body, "changed");

    svc.delete(note.id).await.unwrap();
    assert!(svc.get(note.id).await.is_err());
}

#[sqlx::test(migrator = "app_db::MIGRATOR")]
#[ignore = "needs Postgres: run `make test-db`"]
async fn list_pages_newest_first(pool: PgPool) {
    let svc = service(pool);
    for i in 0..5 {
        svc.create(NewNote { title: format!("n{i}"), body: String::new() }).await.unwrap();
    }
    let page = svc.list(PageRequest::new(Some(2), Some(1))).await.unwrap();
    assert_eq!(page.total, 5);
    let titles: Vec<_> = page.items.iter().map(|n| n.title.as_str()).collect();
    assert_eq!(titles, ["n3", "n2"]);
}
