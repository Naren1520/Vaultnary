-- Migration 004: vault_items table
CREATE TABLE IF NOT EXISTS vault_items (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id            UUID        NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    parent_item_id      UUID        REFERENCES vault_items(id) ON DELETE SET NULL,
    name                TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    credential_type     TEXT        NOT NULL CHECK (credential_type IN (
                            'email', 'website', 'database', 'api_key', 'token',
                            'ssh', 'service_account', 'totp', 'recovery_code', 'custom'
                        )),
    encrypted_payload   BYTEA,
    tags                TEXT[]      NOT NULL DEFAULT '{}',
    notes               TEXT        CHECK (char_length(notes) <= 10000),
    is_favorite         BOOLEAN     NOT NULL DEFAULT false,
    last_accessed_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_items_vault_id        ON vault_items (vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_parent_item_id  ON vault_items (parent_item_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_last_accessed   ON vault_items (last_accessed_at DESC NULLS LAST);

-- GIN index for efficient tag array searches
CREATE INDEX IF NOT EXISTS idx_vault_items_tags ON vault_items USING GIN (tags);

-- Text search index on name
CREATE INDEX IF NOT EXISTS idx_vault_items_name_trgm ON vault_items USING GIN (name gin_trgm_ops);
