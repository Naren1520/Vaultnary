# Permission Model

## Overview

Permissions in Vaultnary are **explicit and per-item**. There is no implicit inheritance — a user must have a row in `credential_permissions` for each specific vault item they can access. A user having permission on a parent item does NOT automatically grant access to child items.

The system uses four roles arranged in a hierarchy. Each role includes all the capabilities of the roles below it.

---

## Role Hierarchy

```
Owner (4)
  └── Co-owner (3)
        └── Editor (2)
              └── Viewer (1)
```

### Role Definitions

**Owner**
- Assigned automatically to the user who creates a vault item
- Can read, update, delete the item
- Can share the item (send invitations)
- Can manage all collaborators (add, change role, remove)
- Can remove other owners
- Cannot be removed if they are the sole owner (enforced by API)
- Only Owners can delete an item (DELETE requires `{ "confirm": true }` in body)

**Co-owner**
- Same as Owner except:
  - Cannot remove the sole Owner
  - Cannot transfer ownership
- Can share and manage permissions

**Editor**
- Can read and update the item (name, tags, notes, encrypted payload)
- Can create and delete usage links (link to projects/services)
- Cannot delete the item itself
- Cannot share or manage permissions

**Viewer**
- Read-only access
- Can mark/unmark the item as a favorite
- Can view usage links
- Cannot modify anything

---

## Action Authorization Matrix

| Action | Viewer | Editor | Co-owner | Owner |
|--------|:------:|:------:|:--------:|:-----:|
| GET /vault/items/:id | ✓ | ✓ | ✓ | ✓ |
| GET /vault/items/:id/children | ✓ | ✓ | ✓ | ✓ |
| POST /vault/items/:id/favorite | ✓ | ✓ | ✓ | ✓ |
| DELETE /vault/items/:id/favorite | ✓ | ✓ | ✓ | ✓ |
| GET /vault/items/:id/usage | ✓ | ✓ | ✓ | ✓ |
| PUT /vault/items/:id | — | ✓ | ✓ | ✓ |
| POST /vault/items/:id/usage | — | ✓ | ✓ | ✓ |
| DELETE /vault/items/:id/usage/:uid | — | ✓ | ✓ | ✓ |
| POST /vault/items/:id/invitations | — | — | ✓ | ✓ |
| GET /vault/items/:id/invitations | — | — | ✓ | ✓ |
| DELETE /vault/items/:id/permissions/:uid | — | — | ✓ | ✓ |
| DELETE /vault/items/:id (confirm: true) | — | — | — | ✓ |

---

## How Permissions Are Assigned

### On item creation
When `POST /vault/items` succeeds, the API inserts a `credential_permissions` row for the creating user with `role = 'owner'` **in the same transaction** as the item insert. There is no window where an item exists without an owner.

### Via invitations
1. Owner or Co-owner sends a `POST /vault/items/:id/invitations` with `invitee_email` and `role`
2. A `share_invitations` row is created with `state = 'pending'` and `expires_at = now() + 7 days`
3. The invitee accepts via `POST /invitations/:id/accept`
4. The API inserts a `credential_permissions` row for the invitee **in the same transaction** as setting the invitation state to `'accepted'`

Permissions are NOT granted until explicit acceptance. A pending invitation gives zero access.

### Removing permissions
`DELETE /vault/items/:id/permissions/:uid` (requires Co-owner or Owner role):
1. Verifies the requester has sufficient role
2. Checks the target is not the sole Owner (returns 422 if so)
3. Deletes `credential_permissions` row
4. Deletes `credential_key_envelopes` row for that user on that item
5. Records `permission.changed` audit event

---

## Permission Storage

```sql
CREATE TABLE credential_permissions (
    id         UUID    PRIMARY KEY,
    item_id    UUID    REFERENCES vault_items(id) ON DELETE CASCADE,
    user_id    UUID    REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT    CHECK (role IN ('owner', 'co_owner', 'editor', 'viewer')),
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ
);
UNIQUE INDEX ON credential_permissions (item_id, user_id);
```

One row per (item, user) pair — a user can only hold one role on an item at a time. The `is_favorite` flag is stored here since it is per-user per-item.

---

## Inherited Access (Informational Only)

If a user has **no** direct `credential_permissions` row for a requested item but **does** have a row on one of its ancestors in the credential tree, the API:

1. Does NOT grant access (returns 404 to the request for the item itself)
2. When returning item metadata, includes `inherited_from: { id, name }` showing the nearest ancestor with a permission

This is **informational only** — it tells the user "you might be able to ask for access to this item since you have access to its parent." The user still receives 404 until a direct permission is granted.

Attempting to create an invitation for an item where the requestor has only inherited access (no direct row) returns **403**.

---

## Invitation Lifecycle

```
State transitions for share_invitations.state:

pending ──accept──> accepted
        ──decline-> declined
        ──revoke──> revoked
        ──(expire)> expired (lazy: checked at read time when expires_at < now())
```

| State | Effect |
|-------|--------|
| pending | No access granted yet. Can be accepted, declined, or revoked. |
| accepted | `credential_permissions` row exists for invitee. |
| declined | Invitee declined. No permission granted. Invitation is closed. |
| revoked | Inviter or Owner revoked. If already accepted, permission row is NOT automatically removed — revocation only stops re-acceptance. To remove actual access, also call DELETE /vault/items/:id/permissions/:uid |
| expired | `expires_at < now()`. Treated as invalid at API level. Cannot be accepted. |

---

## Edge Cases

### Sole owner removal attempt
```
DELETE /vault/items/:id/permissions/:uid
  WHERE target role = 'owner'
  AND COUNT(credential_permissions WHERE role='owner' AND item_id = :id) = 1

-> Returns 422: "cannot remove the sole owner"
```
Every item must always have at least one owner. The item cannot be orphaned.

### Deleting an item
Only Owners can delete. The request body must contain `{ "confirm": true }`. Missing or false returns 422. This prevents accidental deletion from a frontend bug.

The delete operation uses a recursive CTE to collect all descendant item IDs, then deletes in a single transaction:
1. credential_usage rows for all descendants
2. credential_key_envelopes rows for all descendants
3. credential_permissions rows for all descendants
4. vault_items rows for all descendants (in reverse tree order, leaf-first)

### Permission check returns 404 not 403
When a user has no `credential_permissions` row for an item, all endpoints return **404** (not 403). This prevents leaking the existence of items the user has no access to. An attacker guessing item UUIDs gets 404 whether the item exists or does not exist.

---

## Audit Events for Permission Changes

Every permission-relevant action writes an `audit_events` row:

| Action | audit_events.action_type |
|--------|--------------------------|
| Item created (owner auto-assigned) | item.created |
| Invitation sent | invitation.created |
| Invitation accepted | invitation.accepted |
| Invitation declined | invitation.declined |
| Invitation revoked | invitation.revoked |
| Collaborator removed | permission.changed |

Audit events are append-only — the database role used by the application is granted INSERT and SELECT only on `audit_events`. No UPDATE or DELETE is possible at the application level.
