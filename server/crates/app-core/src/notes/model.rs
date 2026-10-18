use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::FieldError;

pub const TITLE_MAX_CHARS: usize = 200;
pub const BODY_MAX_CHARS: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Note {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for creating a note. Validate with [`NewNote::validate`] before use.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewNote {
    pub title: String,
    pub body: String,
}

/// A partial update: `None` leaves the field unchanged.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NoteChanges {
    pub title: Option<String>,
    pub body: Option<String>,
}

impl NewNote {
    /// Trims the title and checks lengths; returns the normalised input.
    pub fn validate(self) -> Result<Self, Vec<FieldError>> {
        let mut errors = Vec::new();
        let title = validate_title(&self.title, &mut errors);
        validate_body(&self.body, &mut errors);
        if errors.is_empty() { Ok(Self { title, body: self.body }) } else { Err(errors) }
    }
}

impl NoteChanges {
    pub fn validate(self) -> Result<Self, Vec<FieldError>> {
        let mut errors = Vec::new();
        let title = self.title.as_deref().map(|t| validate_title(t, &mut errors));
        if let Some(body) = &self.body {
            validate_body(body, &mut errors);
        }
        if errors.is_empty() { Ok(Self { title, body: self.body }) } else { Err(errors) }
    }

    pub fn is_empty(&self) -> bool {
        self.title.is_none() && self.body.is_none()
    }
}

fn validate_title(title: &str, errors: &mut Vec<FieldError>) -> String {
    let title = title.trim();
    if title.is_empty() {
        errors.push(FieldError::new("title", "must not be empty"));
    } else if title.chars().count() > TITLE_MAX_CHARS {
        errors.push(FieldError::new("title", format!("must be at most {TITLE_MAX_CHARS} characters")));
    }
    title.to_owned()
}

fn validate_body(body: &str, errors: &mut Vec<FieldError>) {
    if body.chars().count() > BODY_MAX_CHARS {
        errors.push(FieldError::new("body", format!("must be at most {BODY_MAX_CHARS} characters")));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_is_trimmed() {
        let note = NewNote { title: "  hi  ".into(), body: String::new() }.validate().unwrap();
        assert_eq!(note.title, "hi");
    }

    #[test]
    fn blank_title_is_rejected() {
        let errors = NewNote { title: "   ".into(), body: String::new() }.validate().unwrap_err();
        assert_eq!(errors[0].field, "title");
    }

    #[test]
    fn every_invalid_field_is_reported() {
        let errors = NewNote { title: String::new(), body: "x".repeat(BODY_MAX_CHARS + 1) }.validate().unwrap_err();
        let fields: Vec<_> = errors.iter().map(|e| e.field).collect();
        assert_eq!(fields, ["title", "body"]);
    }
}
