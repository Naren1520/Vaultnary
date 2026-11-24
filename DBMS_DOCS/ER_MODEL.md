# Vaultnary ER Model

This document covers the complete relational model represented by the
application's current migrations, including product data, account/security
records, operational records, and vault-deletion history. The diagrams are split
by purpose to keep them readable.

Coverage: all 19 application tables plus the SQLx migration ledger. Entity boxes
show identifiers, relationships, and important attributes; the full column
catalog is in [`DBMS_SCHEMA_GUIDE.md`](./DBMS_SCHEMA_GUIDE.md).



## 1. Workspace, vault, and sharing data

```mermaid
erDiagram
    USERS {
        UUID id PK
        TEXT email UK
    }

    WORKSPACES {
        UUID id PK
        UUID owner_id FK
        TEXT name
    }

    WORKSPACE_MEMBERS {
        UUID id PK
        UUID workspace_id FK
        UUID user_id FK
        TEXT role
        TIMESTAMPTZ created_at
    }

    PROJECTS {
        UUID id PK
        UUID workspace_id FK
        UUID owner_id FK
        TEXT name
    }

    SERVICES {
        UUID id PK
        UUID project_id FK
        UUID workspace_id FK
        UUID owner_id FK
        TEXT name
        TEXT environment
    }

    VAULTS {
        UUID id PK
        UUID owner_id FK
        UUID workspace_id FK
        UUID service_id FK
        TEXT name
        TIMESTAMPTZ destroy_at
    }

    VAULT_ITEMS {
        UUID id PK
        UUID vault_id FK
        UUID parent_item_id FK
        TEXT name
        TEXT credential_type
        BYTEA encrypted_payload
    }

    CREDENTIAL_PERMISSIONS {
        UUID id PK
        UUID item_id FK
        UUID user_id FK
        TEXT role
        BOOLEAN is_favorite
    }

    SHARE_INVITATIONS {
        UUID id PK
        UUID item_id FK
        UUID inviter_id FK
        TEXT invitee_email
        TEXT role
        TEXT state
        TIMESTAMPTZ expires_at
    }

    CREDENTIAL_KEY_ENVELOPES {
        UUID id PK
        UUID item_id FK
        UUID user_id FK
        BYTEA encrypted_dek
    }

    CREDENTIAL_USAGE {
        UUID id PK
        UUID item_id FK
        UUID project_id FK
        UUID service_id FK
    }

    USERS ||--o{ WORKSPACES : owns
    USERS ||--o{ WORKSPACE_MEMBERS : joins
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : has_members
    WORKSPACES ||--o{ PROJECTS : contains
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ SERVICES : groups
    USERS ||--o{ SERVICES : owns
    SERVICES ||--o{ VAULTS : contains
    USERS ||--o{ VAULTS : owns
    WORKSPACES ||--o{ VAULTS : contains
    VAULTS ||--o{ VAULT_ITEMS : contains
    VAULT_ITEMS o|--o{ VAULT_ITEMS : parent_of
    USERS ||--o{ CREDENTIAL_PERMISSIONS : receives
    VAULT_ITEMS ||--o{ CREDENTIAL_PERMISSIONS : has_permissions
    USERS ||--o{ SHARE_INVITATIONS : sends
    VAULT_ITEMS ||--o{ SHARE_INVITATIONS : invited_for
    USERS ||--o{ CREDENTIAL_KEY_ENVELOPES : receives
    VAULT_ITEMS ||--o{ CREDENTIAL_KEY_ENVELOPES : has_key_envelopes
    VAULT_ITEMS ||--o{ CREDENTIAL_USAGE : has_usage
    PROJECTS o|--o{ CREDENTIAL_USAGE : project_context
    SERVICES o|--o{ CREDENTIAL_USAGE : service_context
```

## 2. Account, cryptographic, and audit data

```mermaid
erDiagram
    USERS {
        UUID id PK
        TEXT email UK
        TEXT password_hash
    }

    AUTH_SESSIONS {
        UUID id PK
        UUID user_id FK
        TEXT token_hash UK
        TIMESTAMPTZ expires_at
        BOOLEAN revoked
    }

    USER_PUBLIC_KEYS {
        UUID id PK
        UUID user_id FK
        TEXT fingerprint UK
    }

    RECOVERY_MATERIAL {
        UUID id PK
        UUID user_id FK
        BYTEA encrypted_private_key
        JSONB kdf_params
    }

    VAULT_KEY_MATERIAL {
        UUID user_id PK
        BYTEA kdf_salt
        BYTEA encrypted_private_key
    }

    ACCOUNT_REQUEST_METRICS {
        UUID user_id PK
        TIMESTAMPTZ bucket_start PK
        BIGINT read_requests
        BIGINT write_requests
        BIGINT error_requests
    }

    AUDIT_EVENTS {
        UUID id PK
        UUID actor_id FK
        TEXT action_type
        UUID resource_id
        TEXT resource_type
        TIMESTAMPTZ created_at
    }

    USERS ||--o{ AUTH_SESSIONS : has
    USERS ||--o{ USER_PUBLIC_KEYS : registers
    USERS ||--o| RECOVERY_MATERIAL : has
    USERS ||--o| VAULT_KEY_MATERIAL : has
    USERS ||--o{ ACCOUNT_REQUEST_METRICS : measured_by
    USERS o|--o{ AUDIT_EVENTS : acts_in
```

## 3. Operational and deletion-history records

```mermaid
erDiagram
    EMAIL_OUTBOX {
        UUID id PK
        TEXT recipient_email
        TEXT subject
        INTEGER attempts
        TIMESTAMPTZ available_at
        TIMESTAMPTZ locked_until
    }

    DELETED_VAULTS {
        UUID id PK
        UUID owner_id
        UUID workspace_id
        UUID service_id
        TEXT name
        TIMESTAMPTZ original_created_at
        TIMESTAMPTZ destroyed_at
        UUID deleted_by
        TEXT reason
    }

    SQLX_MIGRATIONS {
        BIGINT version PK
        TEXT description
        BOOLEAN success
        BYTEA checksum
        BIGINT execution_time
    }
```

This section includes all three remaining records; none has foreign-key
relationships in the schema:

- `EMAIL_OUTBOX` stores recipient email text and queued message content. It does
  not reference a user row.
- `DELETED_VAULTS` stores immutable snapshots with no foreign keys, so deletion
  history remains after the vault or its parent records are removed.
- `SQLX_MIGRATIONS` represents the `_sqlx_migrations` table, the SQLx-managed
  migration ledger, not application business data.

## Relationship and constraint notes

- `||` means exactly one; `o|` means zero or one; `o{` means zero or many.
- `WORKSPACE_MEMBERS` resolves the many-to-many relationship between users and
  workspaces. `(workspace_id, user_id)` is unique.
- `CREDENTIAL_PERMISSIONS` resolves user access to credentials. `(item_id,
  user_id)` is unique, so there is at most one permission per user/credential.
- `RECOVERY_MATERIAL.user_id` is unique, and `VAULT_KEY_MATERIAL.user_id` is
  both its primary key and a foreign key; each is an optional one-to-one
  extension of a user. `ACCOUNT_REQUEST_METRICS` uses the composite primary key
  `(user_id, bucket_start)`, with `user_id` also referencing `USERS`.
- Each `CREDENTIAL_USAGE` row references a credential and at least one of a
  project or service. It can reference both.
- `VAULTS` has a composite foreign key `(service_id, workspace_id)` to
  `SERVICES (id, workspace_id)`, ensuring the selected service belongs to the
  same workspace.
- `VAULT_ITEMS.parent_item_id` is an optional self-reference. The database
  foreign key does not itself enforce that parent and child are in the same
  vault.
- `SHARE_INVITATIONS.invitee_email` is not a user foreign key; invitees may not
  have an account yet.
- `CREDENTIAL_KEY_ENVELOPES` references the recipient user and credential.
  `key_fingerprint` is descriptive text, not a foreign key to `USER_PUBLIC_KEYS`.
- `AUDIT_EVENTS.resource_id` is polymorphic metadata, not a foreign key. Its
  `resource_type` identifies the kind of resource. `actor_id` is optional and
  becomes NULL if the user is deleted.
- `VAULTS.destroy_at` is optional. The application worker schedules deletion;
  database triggers validate future schedule times and protect deletion history,
  but do not run the scheduler.
- `DELETED_VAULTS.owner_id`, `workspace_id`, `service_id`, and `deleted_by` are
  snapshots, not foreign keys.
- Encrypted payloads, private keys, and key envelopes contain ciphertext; the
  diagram does not imply that plaintext secrets are stored in the database.

The table definitions and migration-by-migration details are in
[`DBMS_SCHEMA_GUIDE.md`](./DBMS_SCHEMA_GUIDE.md). The consolidated migration
reference is [`database_schema.sql`](./database_schema.sql).
