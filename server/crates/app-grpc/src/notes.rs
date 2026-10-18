use std::sync::Arc;

use app_core::{
    PageRequest,
    notes::{NewNote, Note, NoteChanges, NoteService},
};
use app_proto::app::v1 as pb;
use tonic::{Request, Response, Status};

use crate::error::{parse_id, status};

#[derive(Debug, Clone)]
pub struct GrpcNoteService {
    notes: Arc<NoteService>,
}

impl GrpcNoteService {
    pub fn new(notes: Arc<NoteService>) -> Self {
        Self { notes }
    }
}

fn timestamp(t: chrono::DateTime<chrono::Utc>) -> prost_types::Timestamp {
    prost_types::Timestamp { seconds: t.timestamp(), nanos: i32::try_from(t.timestamp_subsec_nanos()).unwrap_or(0) }
}

fn to_pb(n: Note) -> pb::Note {
    pb::Note {
        id: n.id.to_string(),
        title: n.title,
        body: n.body,
        create_time: Some(timestamp(n.created_at)),
        update_time: Some(timestamp(n.updated_at)),
    }
}

#[tonic::async_trait]
impl pb::note_service_server::NoteService for GrpcNoteService {
    async fn list_notes(&self, req: Request<pb::ListNotesRequest>) -> Result<Response<pb::ListNotesResponse>, Status> {
        let req = req.into_inner();
        let page = PageRequest::new((req.page_size > 0).then_some(req.page_size), Some(req.offset));
        let page = self.notes.list(page).await.map_err(status)?;
        Ok(Response::new(pb::ListNotesResponse {
            total: page.total,
            notes: page.items.into_iter().map(to_pb).collect(),
        }))
    }

    async fn get_note(&self, req: Request<pb::GetNoteRequest>) -> Result<Response<pb::Note>, Status> {
        let id = parse_id(&req.into_inner().id)?;
        Ok(Response::new(self.notes.get(id).await.map_err(status).map(to_pb)?))
    }

    async fn create_note(&self, req: Request<pb::CreateNoteRequest>) -> Result<Response<pb::Note>, Status> {
        let req = req.into_inner();
        let note = self.notes.create(NewNote { title: req.title, body: req.body }).await.map_err(status)?;
        Ok(Response::new(to_pb(note)))
    }

    async fn update_note(&self, req: Request<pb::UpdateNoteRequest>) -> Result<Response<pb::Note>, Status> {
        let req = req.into_inner();
        let id = parse_id(&req.id)?;
        let note = self.notes.update(id, NoteChanges { title: req.title, body: req.body }).await.map_err(status)?;
        Ok(Response::new(to_pb(note)))
    }

    async fn delete_note(
        &self,
        req: Request<pb::DeleteNoteRequest>,
    ) -> Result<Response<pb::DeleteNoteResponse>, Status> {
        let id = parse_id(&req.into_inner().id)?;
        self.notes.delete(id).await.map_err(status)?;
        Ok(Response::new(pb::DeleteNoteResponse {}))
    }
}

#[cfg(test)]
mod tests {
    use app_core::notes::InMemoryNoteRepository;
    use pb::note_service_server::NoteService as _;
    use tonic::Code;

    use super::*;

    fn service() -> GrpcNoteService {
        GrpcNoteService::new(Arc::new(NoteService::new(Arc::new(InMemoryNoteRepository::default()))))
    }

    #[tokio::test]
    async fn create_and_get() {
        let svc = service();
        let created = svc
            .create_note(Request::new(pb::CreateNoteRequest { title: "hi".into(), body: String::new() }))
            .await
            .unwrap()
            .into_inner();
        let fetched = svc.get_note(Request::new(pb::GetNoteRequest { id: created.id.clone() })).await.unwrap();
        assert_eq!(fetched.into_inner(), created);
    }

    #[tokio::test]
    async fn errors_map_to_grpc_codes() {
        let svc = service();
        let bad_id = svc.get_note(Request::new(pb::GetNoteRequest { id: "nope".into() })).await.unwrap_err();
        assert_eq!(bad_id.code(), Code::InvalidArgument);

        let missing =
            svc.get_note(Request::new(pb::GetNoteRequest { id: uuid::Uuid::now_v7().to_string() })).await.unwrap_err();
        assert_eq!(missing.code(), Code::NotFound);

        let invalid = svc
            .create_note(Request::new(pb::CreateNoteRequest { title: String::new(), body: String::new() }))
            .await
            .unwrap_err();
        assert_eq!(invalid.code(), Code::InvalidArgument);
        assert!(invalid.message().contains("title"));
    }
}
