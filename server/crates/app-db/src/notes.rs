use app_core::{
    CoreResult, Page, PageRequest,
    notes::{Note, NoteChanges, NoteRepository},
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::error::map_err;

const COLUMNS: &str = "id, title, body, created_at, updated_at";

#[derive(Debug, Clone)]
pub struct PgNoteRepository {
    pool: PgPool,
}

impl PgNoteRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct NoteRow {
    id: Uuid,
    title: String,
    body: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<NoteRow> for Note {
    fn from(r: NoteRow) -> Self {
        Self { id: r.id, title: r.title, body: r.body, created_at: r.created_at, updated_at: r.updated_at }
    }
}

#[async_trait]
impl NoteRepository for PgNoteRepository {
    async fn list(&self, page: PageRequest) -> CoreResult<Page<Note>> {
        let offset = i64::try_from(page.offset).unwrap_or(i64::MAX);
        let rows: Vec<NoteRow> = sqlx::query_as(const_format::concatcp!(
            "SELECT ",
            COLUMNS,
            " FROM notes ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2"
        ))
        .bind(i64::from(page.limit))
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        let total: i64 =
            sqlx::query_scalar("SELECT count(*) FROM notes").fetch_one(&self.pool).await.map_err(map_err)?;
        Ok(Page::new(rows.into_iter().map(Note::from).collect(), total.unsigned_abs(), page))
    }

    async fn get(&self, id: Uuid) -> CoreResult<Option<Note>> {
        let row: Option<NoteRow> =
            sqlx::query_as(const_format::concatcp!("SELECT ", COLUMNS, " FROM notes WHERE id = $1"))
                .bind(id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.map(Note::from))
    }

    async fn insert(&self, note: &Note) -> CoreResult<()> {
        sqlx::query("INSERT INTO notes (id, title, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)")
            .bind(note.id)
            .bind(&note.title)
            .bind(&note.body)
            .bind(note.created_at)
            .bind(note.updated_at)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    async fn update(&self, id: Uuid, changes: &NoteChanges, at: DateTime<Utc>) -> CoreResult<Option<Note>> {
        let row: Option<NoteRow> = sqlx::query_as(const_format::concatcp!(
            "UPDATE notes SET title = COALESCE($2, title), body = COALESCE($3, body), updated_at = $4 \
             WHERE id = $1 RETURNING ",
            COLUMNS
        ))
        .bind(id)
        .bind(changes.title.as_deref())
        .bind(changes.body.as_deref())
        .bind(at)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(Note::from))
    }

    async fn delete(&self, id: Uuid) -> CoreResult<bool> {
        let result =
            sqlx::query("DELETE FROM notes WHERE id = $1").bind(id).execute(&self.pool).await.map_err(map_err)?;
        Ok(result.rows_affected() > 0)
    }
}
