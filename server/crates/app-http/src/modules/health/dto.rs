use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    /// `ok` or `unavailable`.
    pub status: &'static str,
    pub version: &'static str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub components: Vec<ComponentDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ComponentDto {
    pub name: &'static str,
    pub healthy: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
