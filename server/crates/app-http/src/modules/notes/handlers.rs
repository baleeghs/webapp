use actix_web::{HttpResponse, http::header, web};
use app_core::PageRequest;
use uuid::Uuid;

use super::dto::{CreateNoteRequest, ListNotesQuery, NoteDto, NotePage, UpdateNoteRequest};
use crate::{AppState, error::ApiResult, error::ErrorBody};

#[utoipa::path(
    get,
    path = "/api/v1/notes",
    tag = "notes",
    params(ListNotesQuery),
    responses((status = 200, description = "Success", body = NotePage), (status = 400, description = "Invalid input", body = ErrorBody))
)]
pub async fn list_notes(
    state: web::Data<AppState>,
    query: web::Query<ListNotesQuery>,
) -> ApiResult<web::Json<NotePage>> {
    let page = state.notes.list(PageRequest::new(query.limit, query.offset)).await?;
    Ok(web::Json(page.into()))
}

#[utoipa::path(
    get,
    path = "/api/v1/notes/{id}",
    tag = "notes",
    params(("id" = Uuid, Path)),
    responses((status = 200, description = "Success", body = NoteDto), (status = 404, description = "Not found", body = ErrorBody))
)]
pub async fn get_note(state: web::Data<AppState>, id: web::Path<Uuid>) -> ApiResult<web::Json<NoteDto>> {
    Ok(web::Json(state.notes.get(*id).await?.into()))
}

#[utoipa::path(
    post,
    path = "/api/v1/notes",
    tag = "notes",
    request_body = CreateNoteRequest,
    responses((status = 201, description = "Created", body = NoteDto), (status = 400, description = "Invalid input", body = ErrorBody))
)]
pub async fn create_note(state: web::Data<AppState>, body: web::Json<CreateNoteRequest>) -> ApiResult<HttpResponse> {
    let note = state.notes.create(body.into_inner().into()).await?;
    Ok(HttpResponse::Created()
        .insert_header((header::LOCATION, format!("/api/v1/notes/{}", note.id)))
        .json(NoteDto::from(note)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/notes/{id}",
    tag = "notes",
    params(("id" = Uuid, Path)),
    request_body = UpdateNoteRequest,
    responses((status = 200, description = "Success", body = NoteDto), (status = 400, description = "Invalid input", body = ErrorBody), (status = 404, description = "Not found", body = ErrorBody))
)]
pub async fn update_note(
    state: web::Data<AppState>,
    id: web::Path<Uuid>,
    body: web::Json<UpdateNoteRequest>,
) -> ApiResult<web::Json<NoteDto>> {
    Ok(web::Json(state.notes.update(*id, body.into_inner().into()).await?.into()))
}

#[utoipa::path(
    delete,
    path = "/api/v1/notes/{id}",
    tag = "notes",
    params(("id" = Uuid, Path)),
    responses((status = 204, description = "Deleted"), (status = 404, description = "Not found", body = ErrorBody))
)]
pub async fn delete_note(state: web::Data<AppState>, id: web::Path<Uuid>) -> ApiResult<HttpResponse> {
    state.notes.delete(*id).await?;
    Ok(HttpResponse::NoContent().finish())
}
