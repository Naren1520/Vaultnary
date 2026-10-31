use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params, Version,
};
use shared::AppError;

/// Hash a plaintext password using Argon2id with hardened parameters.
///
/// Parameters: m=65536 (64 MiB), t=3 (iterations), p=4 (parallelism).
/// A 16-byte random salt is generated via `OsRng` on every call, so two
/// hashes of the same password produce different outputs.
///
/// Returns the PHC string (includes algorithm, params, salt, and hash).
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);

    let params = Params::new(
        65_536, // m_cost: 64 MiB
        3,      // t_cost: 3 iterations
        4,      // p_cost: 4 lanes
        None,   // output length (default 32 bytes)
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Argon2 params error: {e}")))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {e}")))
}

/// Verify a plaintext password against a stored Argon2id PHC hash.
///
/// Uses `argon2::PasswordVerifier`, which performs a constant-time comparison
/// of the derived hash output -the timing is inherently safe.
///
/// Returns `Ok(true)` on match, `Ok(false)` on mismatch.
pub fn verify_password(hash: &str, candidate: &str) -> Result<bool, AppError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid password hash format: {e}")))?;

    let argon2 = Argon2::default();

    match argon2.verify_password(candidate.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(AppError::Internal(anyhow::anyhow!(
            "Password verification error: {e}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_round_trip_passes() {
        let password = "correct-horse-battery-staple-123!";
        let hash = hash_password(password).expect("hashing should succeed");
        assert!(
            verify_password(&hash, password).expect("verify should succeed"),
            "round-trip verify must return true"
        );
    }

    #[test]
    fn wrong_password_fails_verify() {
        let hash = hash_password("my-correct-password-99").expect("hashing should succeed");
        let result = verify_password(&hash, "wrong-password").expect("verify should not error");
        assert!(!result, "wrong password must return false");
    }

    #[test]
    fn two_hashes_of_same_password_are_different() {
        let h1 = hash_password("same-password-abc").unwrap();
        let h2 = hash_password("same-password-abc").unwrap();
        assert_ne!(h1, h2, "salts must differ between calls");
    }

    #[test]
    fn hash_contains_argon2id_identifier() {
        let hash = hash_password("any-password-1234").unwrap();
        assert!(
            hash.starts_with("$argon2id$"),
            "PHC string must begin with $argon2id$, got: {hash}"
        );
    }

    #[test]
    fn minimum_argon2id_params_are_met() {
        let hash = hash_password("param-check-pass-567").unwrap();
        let parsed = argon2::password_hash::PasswordHash::new(&hash).unwrap();

        // Extract param values from the PHC string.
        let m: u32 = parsed
            .params
            .get_decimal("m")
            .expect("m param must be present");
        let t: u32 = parsed
            .params
            .get_decimal("t")
            .expect("t param must be present");
        let p: u32 = parsed
            .params
            .get_decimal("p")
            .expect("p param must be present");

        assert!(m >= 65_536, "m_cost must be ≥ 65536, got {m}");
        assert!(t >= 3, "t_cost must be ≥ 3, got {t}");
        assert!(p >= 4, "p_cost must be ≥ 4, got {p}");
    }
}
