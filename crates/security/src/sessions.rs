use rand::RngCore;
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};

/// Generate a cryptographically random token encoded as a lowercase hex string.
///
/// `bits` must be a positive multiple of 8. For a 128-bit token, pass `128`.
/// The returned string will be `bits / 4` hex characters long (e.g. 32 chars
/// for 128 bits).
pub fn generate_token(bits: usize) -> String {
    assert!(bits > 0 && bits % 8 == 0, "bits must be a positive multiple of 8");
    let byte_len = bits / 8;
    let mut bytes = vec![0u8; byte_len];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Generate a 128-bit CSRF token (32 hex characters).
pub fn generate_csrf_token() -> String {
    generate_token(128)
}

/// Compute the SHA-256 hash of `token` and return it as a lowercase hex string.
///
/// Used to store token hashes in the database instead of plaintext tokens.
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn token_128_bits_has_32_hex_chars() {
        let token = generate_token(128);
        assert_eq!(
            token.len(),
            32,
            "128-bit token must be 32 hex chars, got: {token}"
        );
    }

    #[test]
    fn token_256_bits_has_64_hex_chars() {
        let token = generate_token(256);
        assert_eq!(token.len(), 64);
    }

    #[test]
    fn token_is_lowercase_hex() {
        let token = generate_token(128);
        assert!(
            token.chars().all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()),
            "token must be lowercase hex, got: {token}"
        );
    }

    #[test]
    fn generate_csrf_token_length_is_at_least_32_hex_chars() {
        let token = generate_csrf_token();
        assert!(
            token.len() >= 32,
            "CSRF token must be ≥ 32 hex chars for 128-bit entropy"
        );
    }

    #[test]
    fn tokens_are_unique_across_1000_calls() {
        let mut seen = HashSet::new();
        for _ in 0..1000 {
            let token = generate_token(128);
            assert!(seen.insert(token), "collision detected — tokens must be unique");
        }
    }

    #[test]
    fn hash_token_is_deterministic() {
        let h1 = hash_token("my-raw-token");
        let h2 = hash_token("my-raw-token");
        assert_eq!(h1, h2, "same input must produce same SHA-256 hash");
    }

    #[test]
    fn hash_token_is_64_hex_chars() {
        // SHA-256 = 32 bytes = 64 hex chars
        let h = hash_token("test-token-abc");
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn different_tokens_produce_different_hashes() {
        let h1 = hash_token("token-a");
        let h2 = hash_token("token-b");
        assert_ne!(h1, h2);
    }
}
