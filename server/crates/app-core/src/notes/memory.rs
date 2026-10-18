use std::sync::RwLock;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::{Note, NoteChanges, NoteRepository};
use crate::{CoreError, CoreResult, Page, PageRequest};

/// In-memory [`NoteRepository`] (feature `memory`): for tests, and for running the server without a
/// database. Data lives only as long as the process.
#[derive(Debug, Default)]
pub struct InMemoryNoteRepository {
    notes: RwLock<Vec<Note>>,
}

fn poisoned<T>(_: T) -> CoreError {
    CoreError::internal("in-memory repository lock poisoned")
}

#[async_trait]
impl NoteRepository for InMemoryNoteRepository {
    async fn list(&self, page: PageRequest) -> CoreResult<Page<Note>> {
        let notes = self.notes.read().map_err(poisoned)?;
        // Ids are UUIDv7, so ordering by id is ordering by creation time.
        let mut sorted: Vec<_> = notes.iter().cloned().collect();
        sorted.sort_by_key(|n| std::cmp::Reverse(n.id));
        let offset = usize::try_from(page.offset).unwrap_or(usize::MAX);
        let items = sorted.into_iter().skip(offset).take(page.limit as usize).collect();
        Ok(Page::new(items, notes.len() as u64, page))
    }

    async fn get(&self, id: Uuid) -> CoreResult<Option<Note>> {
        Ok(self.notes.read().map_err(poisoned)?.iter().find(|n| n.id == id).cloned())
    }

    async fn insert(&self, note: &Note) -> CoreResult<()> {
        self.notes.write().map_err(poisoned)?.push(note.clone());
        Ok(())
    }

    async fn update(&self, id: Uuid, changes: &NoteChanges, at: DateTime<Utc>) -> CoreResult<Option<Note>> {
        let mut notes = self.notes.write().map_err(poisoned)?;
        let Some(note) = notes.iter_mut().find(|n| n.id == id) else { return Ok(None) };
        if let Some(title) = &changes.title {
            note.title.clone_from(title);
        }
        if let Some(body) = &changes.body {
            note.body.clone_from(body);
        }
        note.updated_at = at;
        Ok(Some(note.clone()))
    }

    async fn delete(&self, id: Uuid) -> CoreResult<bool> {
        let mut notes = self.notes.write().map_err(poisoned)?;
        let before = notes.len();
        notes.retain(|n| n.id != id);
        Ok(notes.len() != before)
    }
}
