use app_core::health::HealthCheck;
use async_trait::async_trait;
use sqlx::PgPool;

/// Readiness check: one round trip, bounded by the pool's acquire timeout.
#[derive(Debug, Clone)]
pub struct PgHealthCheck {
    pool: PgPool,
}

impl PgHealthCheck {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl HealthCheck for PgHealthCheck {
    fn name(&self) -> &'static str {
        "database"
    }

    async fn check(&self) -> Result<(), String> {
        sqlx::query("SELECT 1").execute(&self.pool).await.map(drop).map_err(|e| e.to_string())
    }
}
