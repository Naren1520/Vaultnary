ALTER TABLE vaults ADD COLUMN IF NOT EXISTS destroy_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vaults_destroy_at
    ON vaults (destroy_at)
    WHERE destroy_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS deleted_vaults (
    id                  UUID PRIMARY KEY,
    owner_id            UUID NOT NULL,
    workspace_id        UUID,
    service_id          UUID,
    name                TEXT NOT NULL,
    original_created_at TIMESTAMPTZ NOT NULL,
    destroyed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_by          UUID,
    reason              TEXT NOT NULL CHECK (reason IN ('scheduled', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_deleted_vaults_owner_destroyed
    ON deleted_vaults (owner_id, destroyed_at DESC);

CREATE OR REPLACE FUNCTION validate_vault_destruction_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.destroy_at IS NOT NULL AND NEW.destroy_at <= NOW() THEN
        RAISE EXCEPTION 'destroy_at must be in the future';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_destruction_schedule_guard ON vaults;
CREATE TRIGGER trg_vault_destruction_schedule_guard
BEFORE INSERT OR UPDATE OF destroy_at ON vaults
FOR EACH ROW
EXECUTE FUNCTION validate_vault_destruction_schedule();

CREATE OR REPLACE FUNCTION protect_deleted_vault_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'deleted vault history records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_deleted_vaults_protect_history_update ON deleted_vaults;
CREATE TRIGGER trg_deleted_vaults_protect_history_update
BEFORE UPDATE OR DELETE ON deleted_vaults
FOR EACH ROW
EXECUTE FUNCTION protect_deleted_vault_history();

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_type_check CHECK (action_type IN (
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
    'permission.changed',
    'vault.scheduled',
    'vault.destruction_cancelled',
    'vault.deleted'
));
