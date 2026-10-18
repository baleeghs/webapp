use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

use super::{NewNote, Note, NoteChanges, NoteRepository};
use crate::{CoreError, CoreResult, Page, PageRequest};

const ENTITY: &str = "note";

/// Business logic for notes. Transports hold an `Arc<NoteService>` and call it; they never talk to
/// a repository directly.
#[derive(Clone)]
pub struct NoteService {
    repo: Arc<dyn NoteRepository>,
}

impl std::fmt::Debug for NoteService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NoteService").finish_non_exhaustive()
    }
}

impl NoteService {
    pub fn new(repo: Arc<dyn NoteRepository>) -> Self {
        Self { repo }
    }

    #[tracing::instrument(skip(self))]
    pub async fn list(&self, page: PageRequest) -> CoreResult<Page<Note>> {
        self.repo.list(page).await
    }

    #[tracing::instrument(skip(self))]
    pub async fn get(&self, id: Uuid) -> CoreResult<Note> {
        self.repo.get(id).await?.ok_or_else(|| CoreError::not_found(ENTITY, id))
    }

    #[tracing::instrument(skip_all)]
    pub async fn create(&self, input: NewNote) -> CoreResult<Note> {
        let input = input.validate().map_err(CoreError::Validation)?;
        let now = Utc::now();
        let note = Note { id: Uuid::now_v7(), title: input.title, body: input.body, created_at: now, updated_at: now };
        self.repo.insert(&note).await?;
        tracing::info!(note.id = %note.id, "note created");
        Ok(note)
    }

    #[tracing::instrument(skip(self, changes))]
    pub async fn update(&self, id: Uuid, changes: NoteChanges) -> CoreResult<Note> {
        let changes = changes.validate().map_err(CoreError::Validation)?;
        if changes.is_empty() {
            return self.get(id).await;
        }
        self.repo.update(id, &changes, Utc::now()).await?.ok_or_else(|| CoreError::not_found(ENTITY, id))
    }

    #[tracing::instrument(skip(self))]
    pub async fn delete(&self, id: Uuid) -> CoreResult<()> {
        if self.repo.delete(id).await? { Ok(()) } else { Err(CoreError::not_found(ENTITY, id)) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notes::InMemoryNoteRepository;

    fn service() -> NoteService {
        NoteService::new(Arc::new(InMemoryNoteRepository::default()))
    }

    fn new_note(title: &str) -> NewNote {
        NewNote { title: title.into(), body: "body".into() }
    }

    #[tokio::test]
    async fn create_then_get() {
        let svc = service();
        let created = svc.create(new_note("first")).await.unwrap();
        assert_eq!(svc.get(created.id).await.unwrap(), created);
    }

    #[tokio::test]
    async fn create_rejects_invalid_input() {
        let err = service().create(new_note("")).await.unwrap_err();
        assert!(matches!(err, CoreError::Validation(_)));
    }

    #[tokio::test]
    async fn update_changes_only_given_fields() {
        let svc = service();
        let note = svc.create(new_note("before")).await.unwrap();
        let updated = svc.update(note.id, NoteChanges { title: Some("after".into()), body: None }).await.unwrap();
        assert_eq!(updated.title, "after");
        assert_eq!(updated.body, note.body);
        assert!(updated.updated_at >= note.updated_at);
    }

    #[tokio::test]
    async fn missing_note_is_not_found() {
        let svc = service();
        let id = Uuid::now_v7();
        assert!(matches!(svc.get(id).await, Err(CoreError::NotFound { .. })));
        assert!(matches!(svc.delete(id).await, Err(CoreError::NotFound { .. })));
        assert!(matches!(
            svc.update(id, NoteChanges { title: Some("x".into()), body: None }).await,
            Err(CoreError::NotFound { .. })
        ));
    }

    #[tokio::test]
    async fn list_is_newest_first_and_paged() {
        let svc = service();
        for i in 0..3 {
            svc.create(new_note(&format!("n{i}"))).await.unwrap();
        }
        let page = svc.list(PageRequest::new(Some(2), None)).await.unwrap();
        assert_eq!(page.total, 3);
        assert_eq!(page.items.iter().map(|n| n.title.as_str()).collect::<Vec<_>>(), ["n2", "n1"]);
    }
}
