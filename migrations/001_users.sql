-- Migration 001: users table
CREATE TABLE IF NOT EXISTS users (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       TEXT        UNIQUE NOT NULL,
    password_hash               TEXT        NOT NULL,
    email_verified              BOOLEAN     NOT NULL DEFAULT false,
    email_verify_token_hash     TEXT,
    email_verify_token_expires_at TIMESTAMPTZ,
    password_reset_token_hash   TEXT,
    password_reset_token_expires_at TIMESTAMPTZ,
    password_change_required    BOOLEAN     NOT NULL DEFAULT false,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
