-- Migration 003: vaults table
CREATE TABLE IF NOT EXISTS vaults (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL DEFAULT 'Default Vault',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One vault per user (enforced by unique index on owner_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vaults_owner_id ON vaults (owner_id);
