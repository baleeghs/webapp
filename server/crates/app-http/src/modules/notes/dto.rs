//! Wire types for `/api/v1/notes`. JSON is camelCase; the web app's types are generated from the
//! OpenAPI document these derive (`make gen-api`), so renaming a field here is an API change.

use app_core::{
    Page,
    notes::{NewNote, Note, NoteChanges},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NoteDto {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Note> for NoteDto {
    fn from(n: Note) -> Self {
        Self { id: n.id, title: n.title, body: n.body, created_at: n.created_at, updated_at: n.updated_at }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NotePage {
    pub items: Vec<NoteDto>,
    pub total: u64,
    pub limit: u32,
    pub offset: u64,
}

impl From<Page<Note>> for NotePage {
    fn from(p: Page<Note>) -> Self {
        let p = p.map(NoteDto::from);
        Self { items: p.items, total: p.total, limit: p.limit, offset: p.offset }
    }
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ListNotesQuery {
    /// Page size, 1..=100 (default 20).
    pub limit: Option<u32>,
    /// Number of notes to skip.
    pub offset: Option<u64>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateNoteRequest {
    /// 1..=200 characters after trimming.
    pub title: String,
    #[serde(default)]
    pub body: String,
}

impl From<CreateNoteRequest> for NewNote {
    fn from(r: CreateNoteRequest) -> Self {
        Self { title: r.title, body: r.body }
    }
}

/// Omitted fields are left unchanged.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub body: Option<String>,
}

impl From<UpdateNoteRequest> for NoteChanges {
    fn from(r: UpdateNoteRequest) -> Self {
        Self { title: r.title, body: r.body }
    }
}
