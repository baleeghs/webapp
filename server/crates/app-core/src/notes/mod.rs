//! Example feature. Copy this module's shape (model, repository port, service) for new features.

#[cfg(any(test, feature = "memory"))]
mod memory;
mod model;
mod repository;
mod service;

#[cfg(any(test, feature = "memory"))]
pub use memory::InMemoryNoteRepository;
pub use model::{NewNote, Note, NoteChanges};
pub use repository::NoteRepository;
pub use service::NoteService;
