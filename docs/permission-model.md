# Permission Model

## Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| Owner | 4 | Full control: read, write, delete, share, manage permissions |
| Co-owner | 3 | Same as Owner except cannot remove the owner or transfer ownership |
| Editor | 2 | Read and write; cannot delete or share |
| Viewer | 1 | Read-only access |

## Action Authorization Matrix

| Action | Viewer | Editor | Co-owner | Owner |
|--------|--------|--------|----------|-------|
| GET /vault/items/:id | Yes | Yes | Yes | Yes |
| PUT /vault/items/:id | No | Yes | Yes | Yes |
| DELETE /vault/items/:id | No | No | No | Yes |
| POST /vault/items/:id/favorite | Yes | Yes | Yes | Yes |
| POST /vault/items/:id/usage | No | Yes | Yes | Yes |
| DELETE /vault/items/:id/usage/:id | No | Yes | Yes | Yes |
| POST /vault/items/:id/invitations | No | No | Yes | Yes |
| GET /vault/items/:id/invitations | No | No | Yes | Yes |
| DELETE /vault/items/:id/permissions/:uid | No | No | Yes | Yes |
| DELETE /vault/items/:id (requires confirm:true) | No | No | No | Yes |

## Explicit Permissions

Permissions are always explicit — there is no automatic inheritance. A user must have a `credential_permissions` row for each item they can access.

## Inherited Access

If a user has no direct permission on an item but has permission on an ancestor in the credential tree, the GET response includes `inherited_from: { id, name }` indicating the nearest ancestor. However, inherited access is informational only — the user still cannot modify or share the item without a direct permission grant.

## Edge Cases

**Sole owner removal:** Attempting to remove the last owner via `DELETE /vault/items/:id/permissions/:uid` returns 422. Every item must have at least one owner.

**Expired invitation:** Invitations where `expires_at < now()` are treated as expired. Accepting an expired invitation returns 422.

**Inherited-only sharing:** A user with only inherited access (no direct `credential_permissions` row) cannot send share invitations for that item. The API returns 403. An explicit permission must be granted first.

**Revoked session:** A request carrying a revoked or expired session token returns 401 regardless of the user's permissions on any resource.
