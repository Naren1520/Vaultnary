-- Migration 006: credential_usage table
CREATE TABLE IF NOT EXISTS credential_usage (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
    project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
    service_id  UUID        REFERENCES services(id) ON DELETE CASCADE,
    environment TEXT        CHECK (char_length(environment) <= 50),
    notes       TEXT        CHECK (char_length(notes) <= 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- At least one of project_id or service_id must be set
    CONSTRAINT chk_usage_target CHECK (project_id IS NOT NULL OR service_id IS NOT NULL)
);

-- Unique partial indexes to prevent duplicate usage records
CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_usage_item_project
    ON credential_usage (item_id, project_id)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_usage_item_service
    ON credential_usage (item_id, service_id)
    WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credential_usage_item_id ON credential_usage (item_id);
