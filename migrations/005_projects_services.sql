-- Migration 005: projects and services tables
CREATE TABLE IF NOT EXISTS projects (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    description TEXT        CHECK (char_length(description) <= 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects (owner_id);

CREATE TABLE IF NOT EXISTS services (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    description TEXT        CHECK (char_length(description) <= 500),
    environment TEXT        NOT NULL CHECK (environment IN ('development', 'staging', 'production', 'custom')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_project_id ON services (project_id);
CREATE INDEX IF NOT EXISTS idx_services_owner_id   ON services (owner_id);
