use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::{Note, NoteChanges};
use crate::{CoreResult, Page, PageRequest};

/// Storage port for notes. Implemented by `app-db` (Postgres), decorated by `app-cache`, and by
/// [`super::InMemoryNoteRepository`] for tests. Implementations map their own errors into
/// [`crate::CoreError`] and never validate input: the service already did.
#[async_trait]
pub trait NoteRepository: Send + Sync {
    /// Newest first.
    async fn list(&self, page: PageRequest) -> CoreResult<Page<Note>>;
    async fn get(&self, id: Uuid) -> CoreResult<Option<Note>>;
    async fn insert(&self, note: &Note) -> CoreResult<()>;
    /// Returns `None` when no note has this id.
    async fn update(&self, id: Uuid, changes: &NoteChanges, at: DateTime<Utc>) -> CoreResult<Option<Note>>;
    /// Returns `false` when no note has this id.
    async fn delete(&self, id: Uuid) -> CoreResult<bool>;
}
