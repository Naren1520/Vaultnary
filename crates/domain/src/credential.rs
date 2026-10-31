use serde::{Deserialize, Serialize};

/// All supported credential types. Exactly 10 variants per spec requirement 8.1.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CredentialType {
    Email,
    Website,
    Database,
    ApiKey,
    Token,
    Ssh,
    ServiceAccount,
    Totp,
    RecoveryCode,
    Custom,
}

/// Deployment environment for services. Exactly 4 variants.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Environment {
    Development,
    Staging,
    Production,
    Custom,
}
