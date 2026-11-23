-- Vaultnary PostgreSQL schema report/reference.
-- Consolidated from migrations/000 through migrations/019 in order.
-- Static source review only: this was not executed or compared with a live database.
-- The SQLx migration ledger below records the repository migrations represented here.
-- The main application data flow is workspace -> project -> service -> vault -> credential.
-- The numbered sections retain historical changes so a teammate can trace how that schema evolved.
-- INSERT/UPDATE statements in migration 012 and 018 are one-time backfills for older databases.
-- Known API/schema gap: invitation handlers update share_invitations.updated_at, but no migration defines it.

-- Wrap the migration sequence in one transaction so it is clear that the historical changes are grouped.
BEGIN;

-- Migration 000: install PostgreSQL extensions used by UUID and fuzzy text-search features.
-- ===== 000_extensions.sql =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Supplies UUID-generation helpers for PostgreSQL installations that use the extension.
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Supplies trigram operators used by the vault-item name-search index.


-- Migration 001: store user accounts and authentication lifecycle data.
-- ===== 001_users.sql =====
CREATE TABLE IF NOT EXISTS users (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable account identifier; generated when omitted.
    email                       TEXT        UNIQUE NOT NULL, -- Login/contact email; uniqueness prevents duplicate accounts.
    password_hash               TEXT        NOT NULL, -- Server-side password verifier; never store the raw password.
    email_verified              BOOLEAN     NOT NULL DEFAULT false, -- Whether the address has been verified.
    email_verify_token_hash     TEXT, -- Hash of the one-time email-verification token.
    email_verify_token_expires_at TIMESTAMPTZ, -- Expiration time for the email-verification token.
    password_reset_token_hash   TEXT, -- Hash of the one-time password-reset token.
    password_reset_token_expires_at TIMESTAMPTZ, -- Expiration time for the password-reset token.
    password_change_required    BOOLEAN     NOT NULL DEFAULT false, -- Forces a password change after account recovery when needed.
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Account creation timestamp.
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Last account-record update timestamp.
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email); -- Supports account lookup by email; the UNIQUE constraint also enforces uniqueness.


-- Migration 002: store revocable browser/device login sessions.
-- ===== 002_auth_sessions.sql =====
CREATE TABLE IF NOT EXISTS auth_sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable session identifier.
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Session owner; deleting the account removes its sessions.
    token_hash          TEXT        UNIQUE NOT NULL, -- Hash used to identify the session without storing its raw token.
    csrf_token_hash     TEXT        NOT NULL, -- Hash of the session's anti-CSRF token.
    ip_address          INET, -- Optional client IP address captured for session history.
    user_agent          TEXT, -- Optional browser/device description.
    device_fingerprint  TEXT        CHECK (char_length(device_fingerprint) <= 512), -- Optional bounded identifier for recognizing a device.
    last_used_at        TIMESTAMPTZ, -- Most recent successful use, if recorded.
    expires_at          TIMESTAMPTZ NOT NULL, -- Time after which the session is no longer valid.
    revoked             BOOLEAN     NOT NULL DEFAULT false, -- Allows a session to be invalidated before expiry.
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Session creation timestamp.
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id   ON auth_sessions (user_id); -- Lists/revokes sessions belonging to an account.
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions (token_hash); -- Speeds up authentication by session-token hash.


-- Migration 003: create the workspace-owned vault container (ownership becomes workspace-based in migration 012).
-- ===== 003_vaults.sql =====
CREATE TABLE IF NOT EXISTS vaults (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable vault identifier.
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Creator/owner retained for account operations.
    name        TEXT        NOT NULL DEFAULT 'Default Vault', -- User-visible vault name.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Vault creation timestamp.
);

-- Historical rule: originally allowed one vault per user; migration 012 replaces this with one vault per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vaults_owner_id ON vaults (owner_id);


-- Migration 004: store encrypted credentials and their optional parent/child hierarchy.
-- ===== 004_vault_items.sql =====
CREATE TABLE IF NOT EXISTS vault_items (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable credential identifier.
    vault_id            UUID        NOT NULL REFERENCES vaults(id) ON DELETE CASCADE, -- Parent vault; deleting a vault deletes its credentials.
    parent_item_id      UUID        REFERENCES vault_items(id) ON DELETE SET NULL, -- Optional parent credential for hierarchy/tree organization.
    name                TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255), -- Required display name with a bounded length.
    credential_type     TEXT        NOT NULL CHECK (credential_type IN ( -- Restricts credentials to types supported by the application.
                            'email', 'website', 'database', 'api_key', 'token',
                            'ssh', 'service_account', 'totp', 'recovery_code', 'custom'
                        )),
    encrypted_payload   BYTEA, -- Encrypted credential values; plaintext is not stored here.
    tags                TEXT[]      NOT NULL DEFAULT '{}', -- Searchable labels attached to the credential.
    notes               TEXT        CHECK (char_length(notes) <= 10000), -- Optional notes field with a maximum length.
    is_favorite         BOOLEAN     NOT NULL DEFAULT false, -- Legacy favorite flag retained in the schema.
    last_accessed_at    TIMESTAMPTZ, -- Most recent access timestamp, when available.
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Credential creation timestamp.
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Credential modification timestamp.
);

CREATE INDEX IF NOT EXISTS idx_vault_items_vault_id        ON vault_items (vault_id); -- Lists credentials inside a vault.
CREATE INDEX IF NOT EXISTS idx_vault_items_parent_item_id  ON vault_items (parent_item_id); -- Finds children in the optional credential hierarchy.
CREATE INDEX IF NOT EXISTS idx_vault_items_last_accessed   ON vault_items (last_accessed_at DESC NULLS LAST); -- Sorts by most recently accessed credentials.

-- GIN indexes support searches over arrays and trigram matches over names.
CREATE INDEX IF NOT EXISTS idx_vault_items_tags ON vault_items USING GIN (tags); -- Accelerates searches for credentials containing a tag.

CREATE INDEX IF NOT EXISTS idx_vault_items_name_trgm ON vault_items USING GIN (name gin_trgm_ops); -- Enables partial/fuzzy matching on credential names.


-- Migration 005: organize work into projects and services.
-- ===== 005_projects_services.sql =====
CREATE TABLE IF NOT EXISTS projects (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable project identifier.
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User who created/owns the project.
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100), -- Required project name.
    description TEXT        CHECK (char_length(description) <= 500), -- Optional short project description.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Project creation timestamp.
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects (owner_id); -- Finds projects by their creator.

CREATE TABLE IF NOT EXISTS services (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable service identifier.
    project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE, -- Historical nullable form; migration 018 makes it required.
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User who created/owns the service.
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100), -- Required service name.
    description TEXT        CHECK (char_length(description) <= 500), -- Optional short service description.
    environment TEXT        NOT NULL CHECK (environment IN ('development', 'staging', 'production', 'custom')), -- Supported environment label.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Service creation timestamp.
);

CREATE INDEX IF NOT EXISTS idx_services_project_id ON services (project_id); -- Lists services belonging to a project.
CREATE INDEX IF NOT EXISTS idx_services_owner_id   ON services (owner_id); -- Finds services by their creator.


-- Migration 006: record which project/service uses a credential and its usage context.
-- ===== 006_credential_usage.sql =====
CREATE TABLE IF NOT EXISTS credential_usage (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable usage-association identifier.
    item_id     UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, -- Credential being associated with work.
    project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE, -- Optional project context.
    service_id  UUID        REFERENCES services(id) ON DELETE CASCADE, -- Optional service context.
    environment TEXT        CHECK (char_length(environment) <= 50), -- Optional environment label for this use.
    notes       TEXT        CHECK (char_length(notes) <= 500), -- Optional explanation of how/where the credential is used.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this usage association was created.

    -- Require the association to point to a project, a service, or both.
    CONSTRAINT chk_usage_target CHECK (project_id IS NOT NULL OR service_id IS NOT NULL)
);

-- Partial unique indexes prevent duplicate associations while allowing either target to be absent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_usage_item_project
    ON credential_usage (item_id, project_id)
    WHERE project_id IS NOT NULL; -- At most one association for a credential/project pair.

CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_usage_item_service
    ON credential_usage (item_id, service_id)
    WHERE service_id IS NOT NULL; -- At most one association for a credential/service pair.

CREATE INDEX IF NOT EXISTS idx_credential_usage_item_id ON credential_usage (item_id); -- Lists all work contexts for a credential.


-- ===== 007_permissions_sharing.sql =====
-- Migration 007: grant per-credential access and track invitations to share credentials.
CREATE TABLE IF NOT EXISTS credential_permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable permission-row identifier.
    item_id     UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, -- Credential the permission applies to.
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User receiving the permission.
    role        TEXT        NOT NULL CHECK (role IN ('owner', 'co_owner', 'editor', 'viewer')), -- Access role enforced by the API.
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Original permission grant timestamp; retained for compatibility.
);

-- The same user can have only one permission row per credential.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_permissions_item_user
    ON credential_permissions (item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_credential_permissions_user_id ON credential_permissions (user_id); -- Lists permissions held by a user.

-- Invitations record pending or completed requests to share a credential.
-- Known mismatch: API accept/decline/revoke handlers update updated_at, but migrations do not define that column.
CREATE TABLE IF NOT EXISTS share_invitations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable invitation identifier.
    item_id         UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, -- Credential being shared.
    inviter_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User who sent the invitation.
    invitee_email   TEXT        NOT NULL, -- Email address the invitation is addressed to.
    role            TEXT        NOT NULL CHECK (role IN ('co_owner', 'editor', 'viewer')), -- Role to grant if accepted.
    state           TEXT        NOT NULL DEFAULT 'pending' -- Lifecycle state of this invitation.
                                CHECK (state IN ('pending', 'accepted', 'declined', 'expired', 'revoked')), -- Allowed state values.
    expires_at      TIMESTAMPTZ NOT NULL, -- Time after which a pending invitation is no longer valid.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Invitation creation timestamp.
);

CREATE INDEX IF NOT EXISTS idx_share_invitations_item_state   ON share_invitations (item_id, state); -- Lists invitations for a credential by state.
CREATE INDEX IF NOT EXISTS idx_share_invitations_invitee_email ON share_invitations (invitee_email); -- Finds invitations addressed to an email.


-- Migration 008: store per-user credential encryption keys, public keys, and recovery material.
-- ===== 008_key_envelopes.sql =====
CREATE TABLE IF NOT EXISTS credential_key_envelopes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable envelope-row identifier.
    item_id         UUID        NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE, -- Credential whose data key is wrapped.
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User who can decrypt the wrapped key.
    encrypted_dek   BYTEA       NOT NULL, -- Encrypted data-encryption key; raw key material is not stored here.
    key_fingerprint TEXT, -- Optional identifier used to check which public key wrapped the data key.
    algorithm       TEXT, -- Optional encryption-algorithm label.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Envelope creation timestamp.
);

-- Each user has at most one key envelope for a given credential.
CREATE UNIQUE INDEX IF NOT EXISTS idx_key_envelopes_item_user
    ON credential_key_envelopes (item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_key_envelopes_item_id ON credential_key_envelopes (item_id); -- Finds all user envelopes for a credential.

CREATE TABLE IF NOT EXISTS user_public_keys (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable public-key-row identifier.
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Account that owns the public key.
    public_key  TEXT        NOT NULL, -- Public key used to wrap keys for sharing.
    fingerprint TEXT        NOT NULL UNIQUE, -- Unique short identifier for the public key.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Key registration timestamp.
);

CREATE INDEX IF NOT EXISTS idx_user_public_keys_user_id ON user_public_keys (user_id); -- Finds keys registered by an account.

CREATE TABLE IF NOT EXISTS recovery_material (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable recovery-record identifier.
    user_id                 UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- One recovery record per account.
    encrypted_private_key   BYTEA       NOT NULL, -- Encrypted private-key backup used by account recovery.
    integrity_tag           BYTEA       NOT NULL, -- Detects tampering with the encrypted recovery material.
    kdf_params              JSONB       NOT NULL, -- Parameters needed to reproduce the key-derivation step.
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Recovery-record creation timestamp.
);


-- Migration 009: record account, session, credential, invitation, and permission activity.
-- The allowed action list is expanded by migration 013.
-- ===== 009_audit_events.sql =====
CREATE TABLE IF NOT EXISTS audit_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable event identifier.
    actor_id        UUID        REFERENCES users(id) ON DELETE SET NULL, -- User who performed the action; retained as NULL if that account is removed.
    action_type     TEXT        NOT NULL CHECK (action_type IN ( -- Event name; constrained to application-supported actions.
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
    resource_id     UUID, -- Optional identifier of the affected object.
    resource_type   TEXT, -- Optional kind of affected object, such as a credential or invitation.
    ip_address      INET, -- Optional client address associated with the event.
    metadata        JSONB       NOT NULL DEFAULT '{}', -- Additional event details in structured form.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Event timestamp; used for history ordering.
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created  ON audit_events (actor_id, created_at DESC); -- Reads a user's recent event history.
CREATE INDEX IF NOT EXISTS idx_audit_events_action_type    ON audit_events (action_type); -- Filters events by action.
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_id    ON audit_events (resource_id); -- Finds events associated with an object.

-- The migration recommends INSERT/SELECT-only privileges for the app role to make this table append-only.
-- The role-specific GRANT is intentionally not applied here because deployment role names/privileges are environment-specific.


-- Migration 010: add structured, non-secret metadata to credential records.
-- ===== 010_vault_items_metadata.sql =====
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS payload_metadata JSONB;


-- Migration 011: add the favorite flag and current creation timestamp used by permission queries.
-- granted_at is retained; created_at is the timestamp name used by application code.
-- ===== 011_permissions_columns.sql =====
ALTER TABLE credential_permissions
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- Migration 012: introduce workspaces and connect existing personal resources to them.
-- ===== 012_workspaces.sql =====
CREATE TABLE workspaces (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable workspace identifier.
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100), -- User-visible workspace name.
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Workspace owner; account deletion removes the workspace.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Workspace creation timestamp.
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Last workspace-record update timestamp.
);

CREATE TABLE workspace_members (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable membership-row identifier.
    workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, -- Workspace the user belongs to.
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Member account.
    role         TEXT        NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')), -- Workspace-level role.
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this membership was created.
    UNIQUE (workspace_id, user_id) -- Prevents duplicate membership rows for one user/workspace pair.
);

CREATE INDEX idx_workspace_members_user_id ON workspace_members (user_id); -- Lists workspaces for a member.

-- Backfill one personal workspace for each existing user so their resources have a workspace parent.
INSERT INTO workspaces (id, name, owner_id)
SELECT gen_random_uuid(), 'Personal Workspace', u.id
FROM users u;

-- Make each generated personal workspace's owner an owner-member.
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w;

-- Add workspace ownership to existing vaults, then make the relationship mandatory.
ALTER TABLE vaults ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE vaults v
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = v.owner_id;
ALTER TABLE vaults ALTER COLUMN workspace_id SET NOT NULL;
DROP INDEX IF EXISTS idx_vaults_owner_id; -- Replaces the old one-vault-per-user rule.
CREATE UNIQUE INDEX idx_vaults_workspace_id ON vaults (workspace_id); -- Allows at most one vault per workspace at this migration stage.

-- Add workspace ownership to existing projects and require every project to belong to one.
ALTER TABLE projects ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE projects p
SET workspace_id = w.id
FROM workspaces w
WHERE w.owner_id = p.owner_id;
ALTER TABLE projects ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_projects_workspace_id ON projects (workspace_id); -- Lists projects in a workspace.

-- Add workspace ownership to services, preferring their project's workspace when available.
ALTER TABLE services ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
UPDATE services s
SET workspace_id = COALESCE(
    (SELECT p.workspace_id FROM projects p WHERE p.id = s.project_id),
    (SELECT w.id FROM workspaces w WHERE w.owner_id = s.owner_id)
);
ALTER TABLE services ALTER COLUMN workspace_id SET NOT NULL;
    CREATE INDEX idx_services_workspace_id ON services (workspace_id); -- Lists services in a workspace.

    -- Add modification timestamps required by project and service update operations.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE services
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


    -- Migration 013: extend allowed audit actions for export/import activity.
-- ===== 013_archive_audit_actions.sql =====
    -- Replace the initial action check so the newly supported actions are accepted.
ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_action_type_check;

    -- Recreate the check with the original actions plus export/import initiation events.
ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_action_type_check
    CHECK (action_type IN (
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
        'export.initiated',
        'import.initiated'
    ));


-- ===== 014_email_outbox.sql =====
-- Migration 014: queue outgoing emails so delivery can be retried asynchronously.
CREATE TABLE email_outbox (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- Stable queued-email identifier.
    recipient_email TEXT        NOT NULL, -- Destination email address.
    subject         TEXT        NOT NULL, -- Email subject line.
    html_body       TEXT        NOT NULL, -- Rendered HTML body to be delivered.
    attempts        INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0), -- Number of delivery attempts; cannot be negative.
    available_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Earliest time the worker may send this email.
    locked_until    TIMESTAMPTZ, -- Temporary worker lease; NULL means no worker currently holds the row.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Queue insertion timestamp.
);

-- Supports selecting the next available, unlocked emails in creation order.
CREATE INDEX idx_email_outbox_available
    ON email_outbox (available_at, locked_until, created_at);


-- Migration 015: allow account deletion to purge audit rows tied to that account.
-- ===== 015_account_audit_purge.sql =====
-- SECURITY DEFINER lets this narrowly scoped function delete audit history even when the caller cannot.
-- The fixed search_path prevents object-name resolution from being redirected by a caller.
CREATE OR REPLACE FUNCTION public.purge_account_audit_events(p_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    -- Remove events where the account was either the actor or the referenced resource.
    DELETE FROM public.audit_events
    WHERE actor_id = p_user_id OR resource_id = p_user_id;
$$;

-- Do not allow arbitrary database roles to call this privileged function.
REVOKE ALL ON FUNCTION public.purge_account_audit_events(UUID) FROM PUBLIC;

-- Grant the privilege only when the deployment has created the conventional app role.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaultnary_app') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.purge_account_audit_events(UUID) TO vaultnary_app';
    END IF;
END
$$;


-- Migration 016: store each user's vault-key setup material and encrypted credential metadata.
-- ===== 016_vault_key_material.sql =====
CREATE TABLE vault_key_material (
    user_id                 UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- One key-material record per account.
    kdf_salt                BYTEA       NOT NULL CHECK (octet_length(kdf_salt) = 16), -- Fixed-size salt used for key derivation.
    encrypted_private_key   BYTEA       NOT NULL CHECK (octet_length(encrypted_private_key) BETWEEN 64 AND 16384), -- Encrypted private-key bytes with size bounds.
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Key-material creation timestamp.
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Most recent key-material update timestamp.
);

-- Keep credential metadata encrypted separately from the main credential payload.
ALTER TABLE vault_items
    ADD COLUMN encrypted_metadata BYTEA;


-- Migration 017: accumulate per-account request counts for the monitoring dashboard.
-- ===== 017_account_request_metrics.sql =====
CREATE TABLE IF NOT EXISTS account_request_metrics (
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Account whose traffic is being counted.
    bucket_start     TIMESTAMPTZ NOT NULL, -- Start time of this aggregation bucket.
    read_requests    BIGINT      NOT NULL DEFAULT 0, -- Number of read requests in the bucket.
    write_requests   BIGINT      NOT NULL DEFAULT 0, -- Number of write requests in the bucket.
    error_requests   BIGINT      NOT NULL DEFAULT 0, -- Number of failed requests in the bucket.
    PRIMARY KEY (user_id, bucket_start) -- One metric row per account and time bucket.
);


-- Migration 018: move vaults under services, completing the workspace -> project -> service -> vault flow.
-- ===== 018_service_vaults.sql =====
-- Add the eventual service parent for each vault; it is made required after legacy rows are backfilled.
ALTER TABLE vaults ADD COLUMN service_id UUID;

-- Identify each workspace that has a legacy direct vault or service without a project.
-- Generated identifiers let the following statements create a project/service pair for those resources.
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

-- Create a "General" project for each workspace requiring a migration parent.
INSERT INTO projects (id, owner_id, workspace_id, name, description)
SELECT
    migration.project_id,
    w.owner_id,
    w.id,
    'General',
    'Migrated workspace resources'
FROM service_vault_migration migration
JOIN workspaces w ON w.id = migration.workspace_id;

-- Attach legacy services without a project to the generated "General" project.
UPDATE services s
SET project_id = migration.project_id
FROM service_vault_migration migration
WHERE s.workspace_id = migration.workspace_id
  AND s.project_id IS NULL;

-- Create a service for each workspace that had a direct workspace vault.
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

-- Attach every legacy workspace vault to the generated service.
UPDATE vaults v
SET service_id = migration.service_id
FROM service_vault_migration migration
WHERE v.workspace_id = migration.workspace_id;

-- Require all services to have a project and all vaults to have a service.
ALTER TABLE services ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE vaults ALTER COLUMN service_id SET NOT NULL;

-- This composite uniqueness is needed by the vault foreign key to ensure service and vault share a workspace.
ALTER TABLE services
    ADD CONSTRAINT uq_services_id_workspace UNIQUE (id, workspace_id);

-- Enforce that each vault's selected service belongs to the same workspace as the vault.
ALTER TABLE vaults
    ADD CONSTRAINT fk_vaults_service_workspace
    FOREIGN KEY (service_id, workspace_id)
    REFERENCES services (id, workspace_id)
    ON DELETE CASCADE;

-- The earlier unique workspace index is no longer needed after vaults become service-owned.
DROP INDEX IF EXISTS idx_vaults_workspace_id;
CREATE INDEX idx_vaults_workspace_id ON vaults (workspace_id); -- Supports workspace-based vault listings without enforcing one vault per workspace.
CREATE INDEX idx_vaults_service_id ON vaults (service_id); -- Supports listing vaults within a service.

-- Migration 019: schedule vault destruction and retain immutable deletion history.
-- ===== 019_vault_destruction.sql =====
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS destroy_at TIMESTAMPTZ; -- Optional server-side scheduled destruction time.

CREATE INDEX IF NOT EXISTS idx_vaults_destroy_at
    ON vaults (destroy_at)
    WHERE destroy_at IS NOT NULL; -- Lets the background worker find only scheduled vaults.

CREATE TABLE IF NOT EXISTS deleted_vaults (
    id                  UUID PRIMARY KEY, -- Original vault ID retained as the deletion-history identifier.
    owner_id            UUID NOT NULL, -- Owner ID snapshot; intentionally not an FK so history survives account deletion.
    workspace_id        UUID, -- Workspace ID snapshot, not an FK.
    service_id          UUID, -- Service ID snapshot, not an FK.
    name                TEXT NOT NULL, -- Name snapshot shown in the deleted-vault history.
    original_created_at TIMESTAMPTZ NOT NULL, -- Original vault creation time.
    destroyed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Time the vault records were removed.
    deleted_by          UUID, -- Actor snapshot; NULL for automated destruction.
    reason              TEXT NOT NULL CHECK (reason IN ('scheduled', 'manual')) -- How the vault was deleted.
);

CREATE INDEX IF NOT EXISTS idx_deleted_vaults_owner_destroyed
    ON deleted_vaults (owner_id, destroyed_at DESC); -- Lists deletion history for an account.

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


-- SQLx migration ledger: records which numbered migrations the application has applied.
-- version/description identify each migration; success records its outcome; checksum detects edited migration files.
-- installed_on is set by PostgreSQL; execution_time is recorded in milliseconds (zero here because this is a report snapshot).
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY, -- Migration version number.
    description TEXT NOT NULL, -- Human-readable migration name derived from its filename.
    installed_on TIMESTAMPTZ NOT NULL DEFAULT now(), -- Time the migration was recorded as installed.
    success BOOLEAN NOT NULL, -- Whether SQLx recorded the migration as successful.
    checksum BYTEA NOT NULL, -- SHA-384 checksum of the original migration source.
    execution_time BIGINT NOT NULL -- Recorded migration runtime in milliseconds.
);

-- One history row per source migration, with its source checksum and a zero placeholder runtime for reporting.
INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES
    (0, 'extensions', true, decode('8535820a12fa7f12fc692774b7e3657eee7d662a61eef66419da1260580d9f2260a2f883afbb6f6d99ba27b3fb4a9fde', 'hex'), 0), -- Installs PostgreSQL extensions.
    (1, 'users', true, decode('23b2c9893b3c66158f969192b5fd8e4c27ea1485c7c7183a54b65ae04aebeb170a3d2e95059112ef09339bdb8d45fa6d', 'hex'), 0), -- Creates user accounts.
    (2, 'auth sessions', true, decode('1e9c570eaf00915753374a7e3be273d493f5522648fff6f03e7869a3be1748736832194e3d9908e894fc0f91ce6e8b4f', 'hex'), 0), -- Adds login sessions.
    (3, 'vaults', true, decode('50b2f4b001569502b0de62b713504f4ebed753919ebb3b21a7d05578371ae7f3090d4b8aa0f1bf6d002f6225ec7e4cec', 'hex'), 0), -- Adds vault containers.
    (4, 'vault items', true, decode('af4fe39bb176658dd4b8a02f9ef06a1ebcb98e8b7470b34ffe9e1173785930907be7c51f952ab6b24275428fb1f2276c', 'hex'), 0), -- Adds credentials and hierarchy.
    (5, 'projects services', true, decode('fd20afd2f44fecbc0ef0afa255201452b801b1034ce4be1a436c04f85550842aaa4580d974a9c6be31cd1b8a210107e4', 'hex'), 0), -- Adds projects and services.
    (6, 'credential usage', true, decode('ea6534f3023057a863b3346333067414f552c723b38b1d281a1e512e93ccb3d0447a12c26e149f346c0f737184a49c9f', 'hex'), 0), -- Adds credential usage links.
    (7, 'permissions sharing', true, decode('5641b655dd1c740076df67a0d362e9e9fd033d83434f3d09ac166f80dc6105fdae3af682bee92bb4c1a6e37646b55bc5', 'hex'), 0), -- Adds access permissions and invitations.
    (8, 'key envelopes', true, decode('9e5a861e5b72766104d997da13632fcf5a6127d1af0c48e5f4261a9648846fa5d374ff6e60d6d6cb6d5464ff21915bfb', 'hex'), 0), -- Adds key envelopes and recovery records.
    (9, 'audit events', true, decode('4b33f1e07dc29d505234bed367302a47d764374bd35ecdf083f0ca28110dd7b91ae76d8691f979255b1ece832dbe6ba6', 'hex'), 0), -- Adds the initial audit-event schema.
    (10, 'vault items metadata', true, decode('0302ac000edafe5d06427010b7e7467ec599db77b77ba6a5f3e842da69aff06ff5cbe7fe9012aacd3790ea2b30a5f600', 'hex'), 0), -- Adds payload metadata.
    (11, 'permissions columns', true, decode('b007af6cf708082413873f9ebefc5c999aaaad15ab9cd5649dc7cf63c983803ebee4279ad6e9ab6a89cb38f27b92c4e1', 'hex'), 0), -- Adds permission favorite/creation columns.
    (12, 'workspaces', true, decode('212009c0c8076aaef42fd7f74a46d16cc5de97b0b5da98c88f345ae270960a84005235ebbdeb1c5b389debaaec5cf4b6', 'hex'), 0), -- Adds workspaces and backfills existing resources.
    (13, 'archive audit actions', true, decode('dac2fdf70a8516c7b800d7462a857955dd22e2b4b8fd03ae704d03afd8b7fc31b674b6089fcd21a8bb11bd9c00c422b1', 'hex'), 0), -- Expands allowed audit actions.
    (14, 'email outbox', true, decode('819d21c4ee35fc5bc557c0c00fd10cf980e8a1c88c61903989e7c13d4bdf4051a114aefc6c60aa5939847bf0c6fcea8f', 'hex'), 0), -- Adds queued email delivery.
    (15, 'account audit purge', true, decode('163ac17e7790dccf4ac0c6d861d2d2348cafc61c46fae641c9ac31e37e0ad6da692999001322f29b0c62714b2cc1fe6d', 'hex'), 0), -- Adds account-related audit cleanup.
    (16, 'vault key material', true, decode('13a08b1ec20053bd0ef9728a6cd5dc93af87d30b0b0cedce0384a1d30c8e6ceaf09f0afe56e2025d2db2eb8a281c74bd', 'hex'), 0), -- Adds vault-key storage.
    (17, 'account request metrics', true, decode('f4eadb888521c18fd6a3c1fd502129f17373ffa53af778e89bec9de09e1d25a8d5bdf54b830e31be1c98f2688e7847e6', 'hex'), 0), -- Adds per-account monitoring metrics.
    (18, 'service vaults', true, decode('a3c1bcad43a1df4c2c8cac9d74422dc2103863892e6cb1b88297d3b3c11bd8aa89fcc3bccdbebafa956af0b0ee66d6aa', 'hex'), 0), -- Makes vaults service-owned.
    (19, 'vault destruction', true, decode('524ea96fe83bdd7b27d83d5fd2e3f2168829af53b42b43d232df952fcdaF2db1884eddcd5691d53a15885fb36a5f4269', 'hex'), 0); -- Adds scheduled destruction and immutable deletion history.

-- End the transaction that groups the migration sequence.
COMMIT;
