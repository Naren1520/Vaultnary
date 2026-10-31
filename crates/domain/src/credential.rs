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

impl CredentialType {
    /// Required keys that must appear in payload_metadata for this credential type.
    pub fn required_fields(&self) -> &'static [&'static str] {
        match self {
            Self::Email => &["address"],
            Self::Website => &["url", "username"],
            Self::Database => &["host", "port", "username", "database_name"],
            Self::ApiKey => &["key"],
            Self::Token => &["value"],
            Self::Ssh => &["private_key"],
            Self::ServiceAccount => &["identifier"],
            Self::Totp => &["secret"],
            Self::RecoveryCode => &["code"],
            Self::Custom => &[],
        }
    }

    /// Parse a snake_case string into a CredentialType.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "email" => Some(Self::Email),
            "website" => Some(Self::Website),
            "database" => Some(Self::Database),
            "api_key" => Some(Self::ApiKey),
            "token" => Some(Self::Token),
            "ssh" => Some(Self::Ssh),
            "service_account" => Some(Self::ServiceAccount),
            "totp" => Some(Self::Totp),
            "recovery_code" => Some(Self::RecoveryCode),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }

    /// Return the canonical snake_case string for this type.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Email => "email",
            Self::Website => "website",
            Self::Database => "database",
            Self::ApiKey => "api_key",
            Self::Token => "token",
            Self::Ssh => "ssh",
            Self::ServiceAccount => "service_account",
            Self::Totp => "totp",
            Self::RecoveryCode => "recovery_code",
            Self::Custom => "custom",
        }
    }
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

/// Validate that all required fields for a given credential type exist in the
/// payload_metadata JSON object. Returns Ok(()) when all are present, or
/// Err with a list of missing field names otherwise.
pub fn validate_payload_metadata(
    ctype: &CredentialType,
    metadata: &serde_json::Value,
) -> Result<(), Vec<String>> {
    let required = ctype.required_fields();
    if required.is_empty() {
        return Ok(());
    }

    let obj = match metadata.as_object() {
        Some(o) => o,
        None => {
            // If metadata is not an object, every required field is missing.
            let missing: Vec<String> = required.iter().map(|s| s.to_string()).collect();
            return Err(missing);
        }
    };

    let missing: Vec<String> = required
        .iter()
        .filter(|&&field| !obj.contains_key(field))
        .map(|s| s.to_string())
        .collect();

    if missing.is_empty() {
        Ok(())
    } else {
        Err(missing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Helper: build a metadata object with all required keys present (empty string values).
    fn all_fields_present(ctype: &CredentialType) -> serde_json::Value {
        let mut map = serde_json::Map::new();
        for &field in ctype.required_fields() {
            map.insert(field.to_string(), json!("value"));
        }
        serde_json::Value::Object(map)
    }

    #[test]
    fn email_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::Email);
        assert!(validate_payload_metadata(&CredentialType::Email, &meta).is_ok());
    }

    #[test]
    fn email_fails_when_address_missing() {
        let meta = json!({});
        let err = validate_payload_metadata(&CredentialType::Email, &meta).unwrap_err();
        assert!(err.contains(&"address".to_string()));
    }

    #[test]
    fn website_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::Website);
        assert!(validate_payload_metadata(&CredentialType::Website, &meta).is_ok());
    }

    #[test]
    fn website_fails_when_url_missing() {
        let meta = json!({ "username": "bob" });
        let err = validate_payload_metadata(&CredentialType::Website, &meta).unwrap_err();
        assert!(err.contains(&"url".to_string()));
    }

    #[test]
    fn database_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::Database);
        assert!(validate_payload_metadata(&CredentialType::Database, &meta).is_ok());
    }

    #[test]
    fn database_fails_when_host_missing() {
        let meta = json!({ "port": "5432", "username": "u", "database_name": "db" });
        let err = validate_payload_metadata(&CredentialType::Database, &meta).unwrap_err();
        assert!(err.contains(&"host".to_string()));
    }

    #[test]
    fn api_key_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::ApiKey);
        assert!(validate_payload_metadata(&CredentialType::ApiKey, &meta).is_ok());
    }

    #[test]
    fn token_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::Token);
        assert!(validate_payload_metadata(&CredentialType::Token, &meta).is_ok());
    }

    #[test]
    fn ssh_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::Ssh);
        assert!(validate_payload_metadata(&CredentialType::Ssh, &meta).is_ok());
    }

    #[test]
    fn service_account_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::ServiceAccount);
        assert!(validate_payload_metadata(&CredentialType::ServiceAccount, &meta).is_ok());
    }

    #[test]
    fn totp_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::Totp);
        assert!(validate_payload_metadata(&CredentialType::Totp, &meta).is_ok());
    }

    #[test]
    fn recovery_code_passes_with_required_fields() {
        let meta = all_fields_present(&CredentialType::RecoveryCode);
        assert!(validate_payload_metadata(&CredentialType::RecoveryCode, &meta).is_ok());
    }

    #[test]
    fn custom_always_passes() {
        // Custom has no required fields — any metadata (including null) should pass.
        assert!(validate_payload_metadata(&CredentialType::Custom, &json!(null)).is_ok());
        assert!(validate_payload_metadata(&CredentialType::Custom, &json!({})).is_ok());
    }

    #[test]
    fn metadata_not_object_returns_all_missing() {
        let meta = json!("not-an-object");
        let err = validate_payload_metadata(&CredentialType::Website, &meta).unwrap_err();
        // Both "url" and "username" should be reported missing.
        assert!(err.contains(&"url".to_string()));
        assert!(err.contains(&"username".to_string()));
    }

    #[test]
    fn from_str_roundtrip() {
        let types = [
            CredentialType::Email,
            CredentialType::Website,
            CredentialType::Database,
            CredentialType::ApiKey,
            CredentialType::Token,
            CredentialType::Ssh,
            CredentialType::ServiceAccount,
            CredentialType::Totp,
            CredentialType::RecoveryCode,
            CredentialType::Custom,
        ];
        for ct in &types {
            let s = ct.as_str();
            let parsed = CredentialType::from_str(s);
            assert_eq!(parsed.as_ref(), Some(ct), "roundtrip failed for {:?}", ct);
        }
    }

    #[test]
    fn from_str_unknown_returns_none() {
        assert!(CredentialType::from_str("unknown_type").is_none());
    }
}
