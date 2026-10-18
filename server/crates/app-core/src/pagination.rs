//! Offset pagination shared by every list endpoint.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PageRequest {
    pub limit: u32,
    pub offset: u64,
}

impl PageRequest {
    pub const DEFAULT_LIMIT: u32 = 20;
    pub const MAX_LIMIT: u32 = 100;

    /// Builds a request from untrusted input, clamping `limit` to `1..=MAX_LIMIT`.
    pub fn new(limit: Option<u32>, offset: Option<u64>) -> Self {
        Self { limit: limit.unwrap_or(Self::DEFAULT_LIMIT).clamp(1, Self::MAX_LIMIT), offset: offset.unwrap_or(0) }
    }
}

impl Default for PageRequest {
    fn default() -> Self {
        Self::new(None, None)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub limit: u32,
    pub offset: u64,
}

impl<T> Page<T> {
    pub fn new(items: Vec<T>, total: u64, req: PageRequest) -> Self {
        Self { items, total, limit: req.limit, offset: req.offset }
    }

    pub fn map<U>(self, f: impl FnMut(T) -> U) -> Page<U> {
        Page {
            items: self.items.into_iter().map(f).collect(),
            total: self.total,
            limit: self.limit,
            offset: self.offset,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limit_is_clamped() {
        assert_eq!(PageRequest::new(Some(0), None).limit, 1);
        assert_eq!(PageRequest::new(Some(10_000), None).limit, PageRequest::MAX_LIMIT);
        assert_eq!(PageRequest::new(None, None).limit, PageRequest::DEFAULT_LIMIT);
    }
}
