CREATE TABLE vault_key_material (
    user_id                 UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    kdf_salt                BYTEA       NOT NULL CHECK (octet_length(kdf_salt) = 16),
    encrypted_private_key   BYTEA       NOT NULL CHECK (octet_length(encrypted_private_key) BETWEEN 64 AND 16384),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vault_items
    ADD COLUMN encrypted_metadata BYTEA;
