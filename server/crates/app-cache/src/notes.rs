use std::sync::Arc;

use app_core::{
    CoreResult, Page, PageRequest,
    notes::{Note, NoteChanges, NoteRepository},
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::TtlCache;

/// Read-through cache for single notes. Lists are not cached: they change on every write and
/// invalidating every page is not worth it.
///
/// Writes evict before and after the inner write. That closes the common race (a stale entry
/// served after an update) but not every interleaving: a read that fetched the old row just
/// before the write commits can still re-insert it, so a reader may see the previous version for
/// at most the cache TTL (`APP_CACHE__TTL_SECS`). Use this decorator only where that bound is
/// acceptable; read-your-writes paths should bypass it or use a versioned cache.
#[derive(Debug)]
pub struct CachedNoteRepository<R> {
    inner: R,
    cache: TtlCache<Uuid, Arc<Note>>,
}

impl<R: NoteRepository> CachedNoteRepository<R> {
    pub fn new(inner: R, cache: TtlCache<Uuid, Arc<Note>>) -> Self {
        Self { inner, cache }
    }
}

#[async_trait]
impl<R: NoteRepository> NoteRepository for CachedNoteRepository<R> {
    async fn list(&self, page: PageRequest) -> CoreResult<Page<Note>> {
        self.inner.list(page).await
    }

    async fn get(&self, id: Uuid) -> CoreResult<Option<Note>> {
        if let Some(note) = self.cache.get(&id).await {
            return Ok(Some(Note::clone(&note)));
        }
        let note = self.inner.get(id).await?;
        if let Some(note) = &note {
            self.cache.insert(id, Arc::new(note.clone())).await;
        }
        Ok(note)
    }

    async fn insert(&self, note: &Note) -> CoreResult<()> {
        self.inner.insert(note).await
    }

    async fn update(&self, id: Uuid, changes: &NoteChanges, at: DateTime<Utc>) -> CoreResult<Option<Note>> {
        self.cache.invalidate(&id).await;
        let result = self.inner.update(id, changes, at).await;
        self.cache.invalidate(&id).await;
        result
    }

    async fn delete(&self, id: Uuid) -> CoreResult<bool> {
        self.cache.invalidate(&id).await;
        let result = self.inner.delete(id).await;
        self.cache.invalidate(&id).await;
        result
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use app_core::notes::{InMemoryNoteRepository, NewNote, NoteService};

    use super::*;

    fn service() -> NoteService {
        let cache = TtlCache::new(100, Duration::from_secs(60));
        NoteService::new(Arc::new(CachedNoteRepository::new(InMemoryNoteRepository::default(), cache)))
    }

    #[tokio::test]
    async fn reads_see_updates() {
        let svc = service();
        let note = svc.create(NewNote { title: "a".into(), body: String::new() }).await.unwrap();
        svc.get(note.id).await.unwrap(); // populate the cache
        svc.update(note.id, NoteChanges { title: Some("b".into()), body: None }).await.unwrap();
        assert_eq!(svc.get(note.id).await.unwrap().title, "b");
    }

    #[tokio::test]
    async fn deleted_notes_are_evicted() {
        let svc = service();
        let note = svc.create(NewNote { title: "a".into(), body: String::new() }).await.unwrap();
        svc.get(note.id).await.unwrap();
        svc.delete(note.id).await.unwrap();
        assert!(svc.get(note.id).await.is_err());
    }
}
