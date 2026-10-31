-- Migration 002: auth_sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          TEXT        UNIQUE NOT NULL,
    csrf_token_hash     TEXT        NOT NULL,
    ip_address          INET,
    user_agent          TEXT,
    device_fingerprint  TEXT        CHECK (char_length(device_fingerprint) <= 512),
    last_used_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked             BOOLEAN     NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id   ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions (token_hash);
