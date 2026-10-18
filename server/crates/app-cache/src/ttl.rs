use std::{hash::Hash, time::Duration};

use app_common::config::CacheConfig;
use moka::future::Cache;

/// A bounded cache whose entries expire `ttl` after insertion.
#[derive(Clone)]
pub struct TtlCache<K, V> {
    inner: Cache<K, V>,
}

impl<K, V> std::fmt::Debug for TtlCache<K, V> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TtlCache").field("entries", &self.inner.entry_count()).finish()
    }
}

impl<K, V> TtlCache<K, V>
where
    K: Hash + Eq + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    pub fn new(max_capacity: u64, ttl: Duration) -> Self {
        Self { inner: Cache::builder().max_capacity(max_capacity).time_to_live(ttl).build() }
    }

    pub fn from_config(config: &CacheConfig) -> Self {
        Self::new(config.max_capacity, config.ttl())
    }

    pub async fn get(&self, key: &K) -> Option<V> {
        self.inner.get(key).await
    }

    pub async fn insert(&self, key: K, value: V) {
        self.inner.insert(key, value).await;
    }

    pub async fn invalidate(&self, key: &K) {
        self.inner.invalidate(key).await;
    }
}
