-- Migration 009: audit_events table (append-only)
CREATE TABLE IF NOT EXISTS audit_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    action_type     TEXT        NOT NULL CHECK (action_type IN (
                        'user.registered',
                        'user.login',
                        'user.logout',
                        'user.password_changed',
                        'user.recovery_used',
                        'session.revoked',
                        'item.created',
                        'item.accessed',
                        'item.updated',
                        'item.deleted',
                        'item.exported',
                        'item.imported',
                        'invitation.created',
                        'invitation.accepted',
                        'invitation.declined',
                        'invitation.revoked',
                        'permission.changed'
                    )),
    resource_id     UUID,
    resource_type   TEXT,
    ip_address      INET,
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created  ON audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_type    ON audit_events (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_id    ON audit_events (resource_id);

-- NOTE: The application database role must be granted INSERT and SELECT only
-- (no UPDATE or DELETE) on audit_events to enforce append-only semantics.
-- This is enforced at the application layer; DB-level GRANT should be run
-- separately for the application role if one exists.
-- GRANT SELECT, INSERT ON audit_events TO vaultnary_app;
