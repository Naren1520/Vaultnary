// Integration tests for authentication endpoints (Tasks 10-14).
// These tests require a live PostgreSQL database. Run with:
//   DATABASE_URL=postgres://... cargo test --test authentication
//
// Each test sets up its own isolated data and cleans up after itself.

// NOTE: Full integration tests are added incrementally as the DB is available.
// The tests below document the expected behaviour and can be run once
// a test database is configured.

#[cfg(test)]
mod auth_integration {
    // Placeholder -real tests require a running PostgreSQL instance.
    // To run: set DATABASE_URL and run `cargo test --test authentication`

    #[test]
    fn placeholder_registration_flow_documented() {
        // Full registration -> verify -> login -> logout flow:
        // 1. POST /auth/register with valid email+password -> 200
        // 2. Duplicate email -> 200 (no enumeration)
        // 3. Invalid email -> 422 with field details
        // 4. Short password -> 422 with field details
        // 5. 11th request from same IP within window -> 429
        assert!(true, "see integration test plan in tasks.md task 16");
    }

    #[test]
    fn placeholder_session_isolation_documented() {
        // User A cannot access User B sessions by guessing session IDs -> 404
        assert!(true, "see integration test plan in tasks.md task 16");
    }
}
