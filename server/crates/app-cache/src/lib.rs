//! In-process caching. [`TtlCache`] is a thin, typed wrapper over `moka`; repository decorators
//! such as [`CachedNoteRepository`] add caching to a feature without touching its service or its
//! storage adapter. Swap in a shared cache (Redis) behind the same decorators when running more
//! than one replica needs consistent reads.

mod notes;
mod ttl;

pub use notes::CachedNoteRepository;
pub use ttl::TtlCache;
