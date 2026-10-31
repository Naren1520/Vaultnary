-- Migration 008: key envelope and recovery tables
CREATE TABLE IF NOT EXISTS credential_key_envelopes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_dek   BYTEA       NOT NULL,
    key_fingerprint TEXT,
    algorithm       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One envelope per (item, user) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_key_envelopes_item_user
    ON credential_key_envelopes (item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_key_envelopes_item_id ON credential_key_envelopes (item_id);

CREATE TABLE IF NOT EXISTS user_public_keys (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key  TEXT        NOT NULL,
    fingerprint TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_public_keys_user_id ON user_public_keys (user_id);

CREATE TABLE IF NOT EXISTS recovery_material (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    encrypted_private_key   BYTEA       NOT NULL,
    integrity_tag           BYTEA       NOT NULL,
    kdf_params              JSONB       NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
