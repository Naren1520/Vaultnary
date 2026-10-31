-- Migration 007: credential_permissions and share_invitations tables
CREATE TABLE IF NOT EXISTS credential_permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('owner', 'co_owner', 'editor', 'viewer')),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One permission record per (item, user) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_permissions_item_user
    ON credential_permissions (item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_credential_permissions_user_id ON credential_permissions (user_id);

CREATE TABLE IF NOT EXISTS share_invitations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
    inviter_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email   TEXT        NOT NULL,
    role            TEXT        NOT NULL CHECK (role IN ('co_owner', 'editor', 'viewer')),
    state           TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (state IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_invitations_item_state   ON share_invitations (item_id, state);
CREATE INDEX IF NOT EXISTS idx_share_invitations_invitee_email ON share_invitations (invitee_email);
