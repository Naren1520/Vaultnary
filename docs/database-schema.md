# Database Schema

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| email_verified | BOOLEAN | NOT NULL DEFAULT false |
| email_verify_token_hash | TEXT | nullable |
| email_verify_token_expires_at | TIMESTAMPTZ | nullable |
| password_reset_token_hash | TEXT | nullable |
| password_reset_token_expires_at | TIMESTAMPTZ | nullable |
| password_change_required | BOOLEAN | NOT NULL DEFAULT false |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### auth_sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> users CASCADE |
| token_hash | TEXT | UNIQUE NOT NULL |
| csrf_token_hash | TEXT | NOT NULL |
| ip_address | INET | nullable |
| user_agent | TEXT | nullable |
| device_fingerprint | TEXT | CHECK(char_length <= 512), nullable |
| last_used_at | TIMESTAMPTZ | nullable |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked | BOOLEAN | NOT NULL DEFAULT false |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Indexes: `idx_auth_sessions_user_id`, `idx_auth_sessions_token_hash`

### vaults
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| owner_id | UUID | FK -> users CASCADE, UNIQUE |
| name | TEXT | NOT NULL DEFAULT 'Default Vault' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### vault_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| vault_id | UUID | FK -> vaults CASCADE |
| parent_item_id | UUID | FK -> vault_items SET NULL, nullable |
| name | TEXT | NOT NULL, CHECK 1-255 chars |
| credential_type | TEXT | NOT NULL, CHECK IN (10 enum values) |
| encrypted_payload | BYTEA | nullable |
| tags | TEXT[] | NOT NULL DEFAULT '{}' |
| notes | TEXT | CHECK <= 10000 chars, nullable |
| is_favorite | BOOLEAN | NOT NULL DEFAULT false |
| last_accessed_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Indexes: `vault_id`, `parent_item_id`, `last_accessed_at DESC`, GIN on `tags`, GIN trigram on `name`

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| owner_id | UUID | FK -> users CASCADE |
| name | TEXT | NOT NULL, CHECK 1-100 chars |
| description | TEXT | CHECK <= 500 chars, nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### services
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK -> projects CASCADE, nullable |
| owner_id | UUID | FK -> users CASCADE |
| name | TEXT | NOT NULL, CHECK 1-100 chars |
| description | TEXT | CHECK <= 500 chars, nullable |
| environment | TEXT | NOT NULL, CHECK IN (development, staging, production, custom) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### credential_usage
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| item_id | UUID | FK -> vault_items CASCADE |
| project_id | UUID | FK -> projects CASCADE, nullable |
| service_id | UUID | FK -> services CASCADE, nullable |
| environment | TEXT | CHECK <= 50 chars, nullable |
| notes | TEXT | CHECK <= 500 chars, nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Constraints: CHECK (project_id IS NOT NULL OR service_id IS NOT NULL)
Unique partial indexes: `(item_id, project_id)` WHERE project_id IS NOT NULL, `(item_id, service_id)` WHERE service_id IS NOT NULL

### credential_permissions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| item_id | UUID | FK -> vault_items CASCADE |
| user_id | UUID | FK -> users CASCADE |
| role | TEXT | NOT NULL, CHECK IN (owner, co_owner, editor, viewer) |
| is_favorite | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Unique index: `(item_id, user_id)`

### share_invitations
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| item_id | UUID | FK -> vault_items CASCADE |
| inviter_id | UUID | FK -> users CASCADE |
| invitee_email | TEXT | NOT NULL |
| role | TEXT | NOT NULL, CHECK IN (co_owner, editor, viewer) |
| state | TEXT | NOT NULL DEFAULT 'pending', CHECK IN (pending, accepted, declined, expired, revoked) |
| expires_at | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Indexes: `(item_id, state)`, `invitee_email`

### credential_key_envelopes
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| item_id | UUID | FK -> vault_items CASCADE |
| user_id | UUID | FK -> users CASCADE |
| encrypted_dek | BYTEA | NOT NULL |
| key_fingerprint | TEXT | nullable |
| algorithm | TEXT | nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Unique index: `(item_id, user_id)`

### user_public_keys
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> users CASCADE |
| public_key | TEXT | NOT NULL |
| fingerprint | TEXT | NOT NULL, UNIQUE |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### recovery_material
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> users CASCADE, UNIQUE |
| encrypted_private_key | BYTEA | NOT NULL |
| integrity_tag | BYTEA | NOT NULL |
| kdf_params | JSONB | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

### audit_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| actor_id | UUID | FK -> users SET NULL, nullable |
| action_type | TEXT | NOT NULL, CHECK IN (17 action types) |
| resource_id | UUID | nullable |
| resource_type | TEXT | nullable |
| ip_address | INET | nullable |
| metadata | JSONB | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

Indexes: `(actor_id, created_at DESC)`, `action_type`, `resource_id`
Application role granted INSERT and SELECT only (no UPDATE or DELETE).

## Index Rationale

- `vault_items.tags` GIN — fast array containment queries for tag-based search
- `vault_items.name` GIN trigram — fast case-insensitive substring search
- `vault_items.last_accessed_at` — fast recent items query (ORDER BY DESC)
- `auth_sessions.token_hash` — O(1) session lookup on every authenticated request
- `audit_events.(actor_id, created_at)` — fast per-user event timeline queries
