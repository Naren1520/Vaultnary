CREATE TABLE workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_members (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT        NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user_id ON workspace_members (user_id);

INSERT INTO workspaces (id, name, owner_id)
SELECT gen_random_uuid(), 'Personal Workspace', u.id
FROM users u;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w;

ALTER TABLE vaults ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE vaults v
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = v.owner_id;
ALTER TABLE vaults ALTER COLUMN workspace_id SET NOT NULL;
DROP INDEX IF EXISTS idx_vaults_owner_id;
CREATE UNIQUE INDEX idx_vaults_workspace_id ON vaults (workspace_id);

ALTER TABLE projects ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE projects p
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = p.owner_id;
ALTER TABLE projects ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_projects_workspace_id ON projects (workspace_id);

ALTER TABLE services ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE services s
SET workspace_id = COALESCE(
    (SELECT p.workspace_id FROM projects p WHERE p.id = s.project_id),
    (SELECT w.id FROM workspaces w WHERE w.owner_id = s.owner_id)
);
ALTER TABLE services ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_services_workspace_id ON services (workspace_id);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
