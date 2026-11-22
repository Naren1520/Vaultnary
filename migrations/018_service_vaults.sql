ALTER TABLE vaults ADD COLUMN service_id UUID;

CREATE TEMP TABLE service_vault_migration ON COMMIT DROP AS
SELECT
    w.id AS workspace_id,
    gen_random_uuid() AS project_id,
    gen_random_uuid() AS service_id
FROM workspaces w
WHERE EXISTS (
    SELECT 1 FROM vaults v WHERE v.workspace_id = w.id
)
OR EXISTS (
    SELECT 1 FROM services s
    WHERE s.workspace_id = w.id AND s.project_id IS NULL
);

INSERT INTO projects (id, owner_id, workspace_id, name, description)
SELECT
    migration.project_id,
    w.owner_id,
    w.id,
    'General',
    'Migrated workspace resources'
FROM service_vault_migration migration
JOIN workspaces w ON w.id = migration.workspace_id;

UPDATE services s
SET project_id = migration.project_id
FROM service_vault_migration migration
WHERE s.workspace_id = migration.workspace_id
  AND s.project_id IS NULL;

INSERT INTO services (
    id, owner_id, workspace_id, project_id, name, description, environment
)
SELECT
    migration.service_id,
    w.owner_id,
    w.id,
    migration.project_id,
    'Workspace credentials',
    'Migrated from the workspace vault',
    'custom'
FROM service_vault_migration migration
JOIN workspaces w ON w.id = migration.workspace_id
WHERE EXISTS (
    SELECT 1 FROM vaults v WHERE v.workspace_id = migration.workspace_id
);

UPDATE vaults v
SET service_id = migration.service_id
FROM service_vault_migration migration
WHERE v.workspace_id = migration.workspace_id;

ALTER TABLE services ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE vaults ALTER COLUMN service_id SET NOT NULL;

ALTER TABLE services
    ADD CONSTRAINT uq_services_id_workspace UNIQUE (id, workspace_id);

ALTER TABLE vaults
    ADD CONSTRAINT fk_vaults_service_workspace
    FOREIGN KEY (service_id, workspace_id)
    REFERENCES services (id, workspace_id)
    ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_vaults_workspace_id;
CREATE INDEX idx_vaults_workspace_id ON vaults (workspace_id);
CREATE INDEX idx_vaults_service_id ON vaults (service_id);
