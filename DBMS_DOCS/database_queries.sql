-- Vaultnary read-only PostgreSQL query guide.
-- These examples use SELECT statements only; they do not insert, update, or delete data.
-- Replace 'person@example.com' with the account email you want to inspect.
-- Replace '00000000-0000-0000-0000-000000000000' with the relevant UUID.
-- Sensitive fields are intentionally excluded: password/token hashes, encrypted credential
-- payloads, key envelopes, recovery keys, email bodies, and arbitrary JSON metadata.
-- Known schema gap: sharing handlers update share_invitations.updated_at, but no migration defines it.

-- =====================================================================
-- 1. DATABASE STRUCTURE
-- =====================================================================

-- List application tables and their columns in the public schema.
-- This helps verify which schema version is installed in the database you are inspecting.
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name <> '_sqlx_migrations'
ORDER BY table_name, ordinal_position;

-- Show the migration versions recorded by SQLx.
-- A missing version can mean the database has not received all application migrations.
SELECT
    version,
    description,
    installed_on,
    success,
    execution_time
FROM _sqlx_migrations
ORDER BY version;


-- =====================================================================
-- 2. ACCOUNTS
-- =====================================================================

-- List registered account emails and basic account status.
-- Password hashes and email/password token hashes are deliberately not selected.
SELECT
    id,
    email,
    email_verified,
    password_change_required,
    created_at,
    updated_at
FROM users
ORDER BY created_at DESC;

-- Find one account by email.
-- Change the example email; LOWER makes the match case-insensitive.
SELECT
    id,
    email,
    email_verified,
    password_change_required,
    created_at,
    updated_at
FROM users
WHERE LOWER(email) = LOWER('person@example.com');

-- Count verified and unverified accounts.
SELECT
    email_verified,
    COUNT(*) AS account_count
FROM users
GROUP BY email_verified
ORDER BY email_verified DESC;


-- =====================================================================
-- 3. WORKSPACES AND MEMBERS
-- =====================================================================

-- List all workspaces the example account belongs to, including its workspace role.
SELECT
    w.id AS workspace_id,
    w.name AS workspace_name,
    w.owner_id,
    wm.role AS member_role,
    w.created_at,
    w.updated_at
FROM users u
JOIN workspace_members wm ON wm.user_id = u.id
JOIN workspaces w ON w.id = wm.workspace_id
WHERE LOWER(u.email) = LOWER('person@example.com')
ORDER BY w.created_at, w.name;

-- List the members of one workspace with their roles and join dates.
SELECT
    u.id AS user_id,
    u.email,
    wm.role,
    wm.created_at AS joined_at
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
WHERE wm.workspace_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY wm.created_at, u.email;

-- Count workspaces by member role for one account.
SELECT
    wm.role,
    COUNT(*) AS workspace_count
FROM users u
JOIN workspace_members wm ON wm.user_id = u.id
WHERE LOWER(u.email) = LOWER('person@example.com')
GROUP BY wm.role
ORDER BY wm.role;


-- =====================================================================
-- 4. PROJECTS, SERVICES, AND VAULTS
-- =====================================================================

-- List projects in one workspace.
SELECT
    id AS project_id,
    workspace_id,
    name,
    description,
    owner_id,
    created_at,
    updated_at
FROM projects
WHERE workspace_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC, name;

-- List services in one project, including each service's environment.
SELECT
    id AS service_id,
    workspace_id,
    project_id,
    name,
    description,
    environment,
    owner_id,
    created_at,
    updated_at
FROM services
WHERE project_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC, name;

-- List vaults in one workspace with their service and project names.
SELECT
    v.id AS vault_id,
    v.name AS vault_name,
    w.name AS workspace_name,
    p.id AS project_id,
    p.name AS project_name,
    s.id AS service_id,
    s.name AS service_name,
    s.environment,
    v.owner_id,
    v.created_at
FROM vaults v
JOIN workspaces w ON w.id = v.workspace_id
JOIN services s ON s.id = v.service_id
JOIN projects p ON p.id = s.project_id
WHERE v.workspace_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY p.name, s.name, v.name;

-- List vaults created/owned by one account.
-- This is different from all vaults the account can access through workspace membership.
SELECT
    v.id AS vault_id,
    v.name AS vault_name,
    w.name AS workspace_name,
    p.name AS project_name,
    s.name AS service_name,
    s.environment,
    v.created_at
FROM users u
JOIN vaults v ON v.owner_id = u.id
JOIN workspaces w ON w.id = v.workspace_id
JOIN services s ON s.id = v.service_id
JOIN projects p ON p.id = s.project_id
WHERE LOWER(u.email) = LOWER('person@example.com')
ORDER BY w.name, p.name, s.name, v.name;

-- List all vaults in workspaces where one account is a member.
-- This includes vaults owned by other workspace members.
SELECT DISTINCT
    v.id AS vault_id,
    v.name AS vault_name,
    w.id AS workspace_id,
    w.name AS workspace_name,
    p.name AS project_name,
    s.name AS service_name,
    s.environment,
    v.owner_id,
    v.created_at
FROM users u
JOIN workspace_members wm ON wm.user_id = u.id
JOIN workspaces w ON w.id = wm.workspace_id
JOIN vaults v ON v.workspace_id = w.id
JOIN services s ON s.id = v.service_id
JOIN projects p ON p.id = s.project_id
WHERE LOWER(u.email) = LOWER('person@example.com')
ORDER BY w.name, p.name, s.name, v.name;

-- Count projects, services, and vaults in each workspace.
SELECT
    w.id AS workspace_id,
    w.name AS workspace_name,
    COUNT(DISTINCT p.id) AS project_count,
    COUNT(DISTINCT s.id) AS service_count,
    COUNT(DISTINCT v.id) AS vault_count
FROM workspaces w
LEFT JOIN projects p ON p.workspace_id = w.id
LEFT JOIN services s ON s.workspace_id = w.id
LEFT JOIN vaults v ON v.workspace_id = w.id
GROUP BY w.id, w.name
ORDER BY w.name;


-- =====================================================================
-- 5. CREDENTIALS AND OPTIONAL CREDENTIAL HIERARCHY
-- =====================================================================

-- List credential metadata in one vault.
-- Encrypted payloads and free-form notes are intentionally omitted.
SELECT
    id AS credential_id,
    vault_id,
    parent_item_id,
    name,
    credential_type,
    tags,
    is_favorite,
    last_accessed_at,
    created_at,
    updated_at
FROM vault_items
WHERE vault_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at, name;

-- Display a credential hierarchy as a depth-indented list.
-- The visited_path guard prevents accidental infinite recursion if bad parent links exist.
WITH RECURSIVE credential_tree AS (
    -- Begin with root credentials in the selected vault.
    SELECT
        vi.id,
        vi.parent_item_id,
        vi.name,
        vi.credential_type,
        0 AS depth,
        ARRAY[vi.id]::uuid[] AS visited_path
    FROM vault_items vi
    WHERE vi.vault_id = '00000000-0000-0000-0000-000000000000'::uuid
      AND vi.parent_item_id IS NULL

    UNION ALL

    -- Repeatedly add children whose parent is already in the result.
    SELECT
        child.id,
        child.parent_item_id,
        child.name,
        child.credential_type,
        parent.depth + 1,
        parent.visited_path || child.id
    FROM vault_items child
    JOIN credential_tree parent ON child.parent_item_id = parent.id
    WHERE child.vault_id = '00000000-0000-0000-0000-000000000000'::uuid
      AND NOT child.id = ANY(parent.visited_path)
)
SELECT
    id AS credential_id,
    parent_item_id,
    depth,
    REPEAT('  ', depth) || name AS hierarchy_name,
    credential_type
FROM credential_tree
ORDER BY visited_path;

-- Show the project/service contexts linked to one credential.
-- Usage notes are omitted because they are free-form user-entered text.
SELECT
    cu.id AS usage_id,
    cu.item_id AS credential_id,
    p.name AS project_name,
    s.name AS service_name,
    cu.environment,
    cu.created_at
FROM credential_usage cu
LEFT JOIN projects p ON p.id = cu.project_id
LEFT JOIN services s ON s.id = cu.service_id
WHERE cu.item_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY cu.created_at DESC;

-- Find credentials whose parent is in a different vault.
-- The application is expected to keep hierarchy links inside one vault.
SELECT
    child.id AS credential_id,
    child.name AS credential_name,
    child.vault_id AS credential_vault_id,
    parent.id AS parent_id,
    parent.name AS parent_name,
    parent.vault_id AS parent_vault_id
FROM vault_items child
JOIN vault_items parent ON parent.id = child.parent_item_id
WHERE child.vault_id <> parent.vault_id
ORDER BY child.vault_id, child.name;


-- =====================================================================
-- 6. CREDENTIAL ACCESS AND SHARING
-- =====================================================================

-- List the users and roles with access to one credential.
SELECT
    cp.item_id AS credential_id,
    u.id AS user_id,
    u.email,
    cp.role,
    cp.is_favorite,
    cp.created_at AS permission_created_at,
    cp.granted_at
FROM credential_permissions cp
JOIN users u ON u.id = cp.user_id
WHERE cp.item_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY cp.role, u.email;

-- List invitations for one credential, including their current state and expiration.
-- Do not select updated_at: the API references it, but the repository migrations do not create it.
SELECT
    id AS invitation_id,
    item_id AS credential_id,
    inviter_id,
    invitee_email,
    role,
    state,
    expires_at,
    created_at
FROM share_invitations
WHERE item_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC;

-- List credentials shared with one account and the account's assigned role.
SELECT
    u.email,
    cp.role,
    vi.id AS credential_id,
    vi.name AS credential_name,
    vi.credential_type,
    v.name AS vault_name,
    w.name AS workspace_name
FROM users u
JOIN credential_permissions cp ON cp.user_id = u.id
JOIN vault_items vi ON vi.id = cp.item_id
JOIN vaults v ON v.id = vi.vault_id
JOIN workspaces w ON w.id = v.workspace_id
WHERE LOWER(u.email) = LOWER('person@example.com')
ORDER BY w.name, v.name, vi.name;


-- =====================================================================
-- 7. LOGIN SESSIONS AND AUDIT HISTORY
-- =====================================================================

-- List session/device metadata for one account.
-- Session token and CSRF hashes are intentionally excluded.
SELECT
    s.id AS session_id,
    s.ip_address,
    s.user_agent,
    s.device_fingerprint,
    s.last_used_at,
    s.expires_at,
    s.revoked,
    s.created_at
FROM users u
JOIN auth_sessions s ON s.user_id = u.id
WHERE LOWER(u.email) = LOWER('person@example.com')
ORDER BY s.created_at DESC;

-- List recent audit events performed by one account.
-- The free-form metadata JSON is omitted to avoid exposing unrelated details.
SELECT
    ae.id AS event_id,
    ae.action_type,
    ae.resource_type,
    ae.resource_id,
    ae.ip_address,
    ae.created_at
FROM users u
JOIN audit_events ae ON ae.actor_id = u.id
WHERE LOWER(u.email) = LOWER('person@example.com')
ORDER BY ae.created_at DESC
LIMIT 100;

-- List recent audit events for a particular resource, regardless of actor.
SELECT
    ae.id AS event_id,
    u.email AS actor_email,
    ae.action_type,
    ae.resource_type,
    ae.resource_id,
    ae.created_at
FROM audit_events ae
LEFT JOIN users u ON u.id = ae.actor_id
WHERE ae.resource_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY ae.created_at DESC
LIMIT 100;


-- =====================================================================
-- 8. MONITORING AND QUEUED EMAIL STATUS
-- =====================================================================

-- Show request metrics for one account for the last 24 hours.
SELECT
    bucket_start,
    read_requests,
    write_requests,
    error_requests
FROM account_request_metrics
WHERE user_id = (
    SELECT id
    FROM users
    WHERE LOWER(email) = LOWER('person@example.com')
)
  AND bucket_start >= NOW() - INTERVAL '24 hours'
ORDER BY bucket_start;

-- Summarize all accounts' request counts over the last 24 hours.
SELECT
    SUM(read_requests) AS total_reads,
    SUM(write_requests) AS total_writes,
    SUM(error_requests) AS total_errors
FROM account_request_metrics
WHERE bucket_start >= NOW() - INTERVAL '24 hours';

-- Show queued-email counts without exposing recipient content or HTML bodies.
SELECT
    COUNT(*) AS queued_email_count,
    COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW()) AS currently_locked_count,
    COUNT(*) FILTER (WHERE available_at <= NOW() AND (locked_until IS NULL OR locked_until <= NOW())) AS ready_to_send_count,
    COALESCE(SUM(attempts), 0) AS total_attempts
FROM email_outbox;


-- =====================================================================
-- 9. QUICK INVENTORY AND DATA-CONSISTENCY CHECKS
-- =====================================================================

-- Count the main application records at a glance.
SELECT 'users' AS record_type, COUNT(*) AS record_count FROM users
UNION ALL
SELECT 'workspaces', COUNT(*) FROM workspaces
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'services', COUNT(*) FROM services
UNION ALL
SELECT 'vaults', COUNT(*) FROM vaults
UNION ALL
SELECT 'credentials', COUNT(*) FROM vault_items
UNION ALL
SELECT 'credential permissions', COUNT(*) FROM credential_permissions
UNION ALL
SELECT 'share invitations', COUNT(*) FROM share_invitations
UNION ALL
SELECT 'audit events', COUNT(*) FROM audit_events
ORDER BY record_type;

-- Summarize one account's main workspace hierarchy counts.
SELECT
    u.id AS user_id,
    u.email,
    COUNT(DISTINCT wm.workspace_id) AS workspace_count,
    COUNT(DISTINCT p.id) AS project_count,
    COUNT(DISTINCT s.id) AS service_count,
    COUNT(DISTINCT v.id) AS vault_count
FROM users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id
LEFT JOIN projects p ON p.workspace_id = wm.workspace_id
LEFT JOIN services s ON s.workspace_id = wm.workspace_id
LEFT JOIN vaults v ON v.workspace_id = wm.workspace_id
WHERE LOWER(u.email) = LOWER('person@example.com')
GROUP BY u.id, u.email;

-- Find credentials that do not have a permission row.
-- The application normally creates an owner permission when it creates/imports a credential.
SELECT
    vi.id AS credential_id,
    vi.name AS credential_name,
    vi.vault_id,
    vi.created_at
FROM vault_items vi
WHERE NOT EXISTS (
    SELECT 1
    FROM credential_permissions cp
    WHERE cp.item_id = vi.id
)
ORDER BY vi.created_at DESC;

-- Count which key/recovery setup records exist for each account without returning key material.
SELECT
    u.id AS user_id,
    u.email,
    EXISTS (
        SELECT 1 FROM vault_key_material vkm WHERE vkm.user_id = u.id
    ) AS has_vault_key_material,
    EXISTS (
        SELECT 1 FROM recovery_material rm WHERE rm.user_id = u.id
    ) AS has_recovery_material,
    EXISTS (
        SELECT 1 FROM user_public_keys upk WHERE upk.user_id = u.id
    ) AS has_public_key
FROM users u
ORDER BY u.email;
