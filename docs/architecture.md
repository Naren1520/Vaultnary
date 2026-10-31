# Architecture

## Technology Stack

### Backend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | Rust | stable (1.82+) | Type safety, memory safety, performance |
| Web framework | Axum | 0.7 | Async HTTP server built on Tokio |
| Async runtime | Tokio | 1.x (full features) | Multi-threaded async executor |
| Database driver | SQLx | 0.7 | Async PostgreSQL client with compile-time query checking |
| Database | PostgreSQL | 16 | Primary data store, 13 tables |
| Session cache | Redis | 7 | Ephemeral rate-limit counters only |
| Redis client | fred | 9 | Async Redis client supporting Lua scripting |
| Password hashing | argon2 | 0.5 | Argon2id with m=65536, t=3, p=4 |
| Serialisation | serde + serde_json | 1.x | JSON encoding/decoding |
| Validation | validator | 0.18 | Email format validation |
| Tracing | tracing + tracing-subscriber | 0.1/0.3 | Structured logging, JSON and human modes |
| Time | time | 0.3 | Timestamp arithmetic |
| UUID | uuid | 1.x | v4 random UUIDs for all primary keys |
| Error handling | thiserror + anyhow | 1.x | Typed errors and propagation |

### Frontend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | TypeScript | 5.7 strict | Type safety throughout |
| Framework | React | 19 | UI rendering |
| Build tool | Vite | 6 | Fast dev server, code splitting |
| Router | React Router | 7 | Client-side routing |
| State management | Zustand | 5 | In-memory session and vault key state |
| Icons | lucide-react | 0.469 | Consistent icon set |
| KDF | argon2-browser | 1.18 | Argon2id WASM in the browser |
| Testing | Vitest | 2.1 | Unit and integration tests |

### Infrastructure
| Component | Technology | Notes |
|-----------|-----------|-------|
| Containerisation | Docker Compose | Multi-service orchestration |
| Static serving | nginx | Serves Vite dist/, proxies /api/v1 |
| CI security | GitHub Actions | cargo audit, npm audit, tests, build |

---

## Cargo Workspace Structure

```
Vaultnary/
├── Cargo.toml                  — workspace manifest, shared dependency versions
├── rust-toolchain.toml         — pins stable Rust toolchain
│
├── apps/
│   └── api/                    — Axum binary crate
│       └── src/
│           ├── main.rs         — Tokio entry point, calls bootstrap::run()
│           ├── bootstrap.rs    — wires middleware layers, connects DB + Redis, binds TCP
│           ├── config.rs       — reads all env vars at startup, panics if missing
│           ├── state.rs        — AppState (PgPool + RedisPool + Config) wrapped in Arc
│           ├── error.rs        — ApiError: maps AppError -> HTTP status + JSON body
│           ├── middleware/
│           │   ├── request_id.rs  — attaches X-Request-Id UUID to every request/response
│           │   ├── rate_limit.rs  — Redis sliding-window counter via atomic Lua script
│           │   ├── auth.rs        — validates vault_session cookie, populates AuthUser extension
│           │   └── csrf.rs        — validates X-CSRF-Token on POST/PUT/PATCH/DELETE
│           └── routes/
│               ├── mod.rs         — registers all routes under /api/v1/
│               ├── auth.rs        — registration, login, logout, password, sessions
│               ├── vaults.rs      — vault item CRUD, search, favorites, recent
│               ├── hierarchy.rs   — tree endpoint, children endpoint
│               ├── projects.rs    — project CRUD + credentials
│               ├── services.rs    — service CRUD + credentials
│               ├── usage.rs       — credential usage links
│               ├── sharing.rs     — invitations, accept/decline/revoke, remove permission
│               ├── recovery.rs    — recovery setup, recovery endpoint
│               ├── sessions.rs    — security center: sessions, events, invitations, shared-with-me
│               ├── audit.rs       — paginated audit event log
│               └── users.rs       — user profile, lookup by email
│
├── crates/
│   ├── shared/                 — AppError enum, UUID newtypes (UserId, VaultId, etc.)
│   ├── domain/                 — CredentialType enum, Environment enum, PermissionRole,
│   │                             InvitationState, validate_payload_metadata(), check_cycle()
│   ├── application/            — (stub) use-case structs for future extraction
│   ├── persistence/            — (stub) repository trait interfaces
│   └── security/
│       ├── password_hashing.rs — hash_password(), verify_password() using Argon2id
│       └── sessions.rs         — generate_token(), generate_csrf_token(), hash_token()
│
├── migrations/                 — SQL migration files (000-009)
├── tests/                      — integration test stubs
├── docs/                       — this documentation
└── deploy/                     — Dockerfiles, compose.yaml, nginx.conf
```

---

## Frontend Directory Structure

```
apps/web/src/
├── main.tsx                    — React root, mounts <App />, imports global CSS
├── App.tsx                     — <RouterProvider> wrapper
├── router/
│   └── routes.tsx              — all routes, ProtectedRoute, VaultUnlockGate
│
├── state/
│   ├── auth-store.ts           — Zustand: csrfToken (in-memory only)
│   └── vault-store.ts          — Zustand: masterKey, privateKey, isUnlocked (in-memory only)
│
├── services/
│   ├── http-client.ts          — fetch wrapper: CSRF injection, 401/422/429/5xx handling
│   ├── error-handler.ts        — typed error classes: ValidationError, RateLimitError, ServerError
│   └── validation.ts           — client-side validators mirroring backend rules
│
├── crypto/
│   ├── kdf.ts                  — deriveKey() via argon2-browser WASM
│   ├── nonce.ts                — generateNonce() via crypto.getRandomValues
│   ├── symmetric.ts            — encrypt()/decrypt() using AES-256-GCM (Web Crypto)
│   ├── asymmetric.ts           — generateKekPair(), encryptDek(), decryptDek() (RSA-OAEP)
│   ├── envelope.ts             — sealItem(), openItem(), generateDek()
│   └── vault-session.ts        — unlockVault(), lockVault() integrating vault-store
│
├── components/
│   ├── ui/                     — Sidebar, Topbar, Breadcrumbs, Inspector, SkeletonLoader,
│   │                             DataTable, TreeView, Toast, Modal, CredentialBadge
│   ├── forms/
│   │   └── VaultItemForm.tsx   — dynamic create/edit form for all 10 credential types
│   └── feedback/
│       ├── EmptyState.tsx
│       └── ErrorBoundary.tsx
│
├── features/
│   ├── landing/                — landing page + CSS
│   ├── auth/                   — LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage
│   ├── shell/                  — AppShell (sidebar + outlet), NotAuthorizedPage
│   ├── vault/                  — VaultPage, VaultList, VaultItemDetail, SecretField
│   ├── hierarchy/              — HierarchyPage, VaultTree
│   ├── projects/               — ProjectsPage, ProjectDetail
│   ├── services/               — ServicesPage, ServiceDetail
│   ├── usage/                  — UsageDetail
│   ├── sharing/                — InvitationFlow
│   ├── security-center/        — SecurityCenterPage, RecoverySetup
│   ├── audit/                  — AuditLogPage
│   └── search/                 — GlobalSearch
│
└── styles/
    ├── tokens.css              — all CSS custom properties (colors, spacing, typography)
    ├── reset.css               — minimal CSS reset
    └── utilities.css           — spacing, flex, text utility classes
```

---

## Request Lifecycle

Every HTTP request through the API passes through the following layers in order:

```
Client request
    |
    v
1. RequestIdLayer
   - Generates or preserves X-Request-Id UUID header
   - Echoes the same ID on the response for request tracing
    |
    v
2. TraceLayer (tower-http)
   - Creates a structured tracing span per request
   - Logs method, path, status, latency
   - JSON format when LOG_FORMAT=json, human-readable otherwise
    |
    v
3. RateLimitLayer
   - Extracts client IP from X-Forwarded-For or socket address
   - Calls Redis Lua script: INCR key; EXPIRE key window_seconds
   - Returns 429 if count > max_requests; fails open if Redis is unavailable
   - Configurable per route group (window duration, max requests)
    |
    v
4. AuthSessionLayer
   - Extracts vault_session cookie value
   - SHA-256 hashes it
   - Queries auth_sessions WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()
   - On valid session: inserts AuthUser { user_id, session_id, csrf_token_hash } into request extensions
   - On invalid/expired/revoked: returns 401 and clears the cookie
   - If no cookie present: passes through (unauthenticated routes work normally)
    |
    v
5. CsrfGuardLayer
   - Only acts on POST, PUT, PATCH, DELETE
   - Skips if no AuthUser extension (unauthenticated request)
   - Reads X-CSRF-Token header
   - SHA-256 hashes the header value
   - Compares to auth_user.csrf_token_hash
   - Returns 403 if missing or mismatched
    |
    v
6. Route handler
   - Business logic
   - SQLx database queries (no compile-time checking — runtime queries for flexibility)
   - Audit event insertion after successful mutations
   - Structured JSON response via ApiError or direct Json()
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `PORT` | Yes | — | TCP port the API binds to |
| `SESSION_SECRET` | Yes | — | Used for any future signing; presence enforced at startup |
| `LOG_FORMAT` | No | human | `json` for structured production logs, `human` for development |
| `APP_ENV` | No | development | `production` enables Secure cookie attribute on vault_session |
| `SMTP_HOST` | No | — | SMTP server; if blank, verification tokens are logged via tracing |
| `SMTP_PORT` | No | 587 | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | noreply@example.com | From address for verification and reset emails |

---

## Docker Compose Services

```
postgres  — postgres:16-alpine
           Health: pg_isready -U vaultnary
           Volume: postgres_data (named, persistent)

redis     — redis:7-alpine
           Health: redis-cli ping
           No named volume — rate limit counters are ephemeral by design

migrate   — ghcr.io/launchbadge/sqlx-cli
           Command: sqlx migrate run
           Depends on: postgres (healthy)
           Restart policy: on-failure (exits 0 on success)

api       — built from deploy/Dockerfile (multi-stage Rust build)
           Depends on: migrate (completed), redis (healthy)
           Reads secrets from environment variables only

web       — built from apps/web/Dockerfile (multi-stage Node/nginx build)
           Stage 1: npm run build -> dist/
           Stage 2: nginx:alpine serving dist/, proxying /api/v1/* to api:8080
           Security headers set in deploy/nginx.conf
```

---

## API Route Summary

All routes are under `/api/v1/`. Authenticated routes require a valid `vault_session` cookie. Mutating routes additionally require `X-CSRF-Token`.

### Authentication (`/auth/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | No | Register; hash password, insert user+vault, send verification email |
| GET | /auth/verify-email | No | Verify email token (24-hour expiry) |
| POST | /auth/resend-verification | No | Resend verification; rate-limited 3/email/60min |
| POST | /auth/login | No | Authenticate; set HttpOnly cookie, return CSRF token |
| POST | /auth/logout | Yes | Revoke session, clear cookie |
| POST | /auth/change-password | Yes | Verify current password, update hash, revoke other sessions |
| POST | /auth/forgot-password | No | Generate reset token (60min), send email; dummy hash if no account |
| POST | /auth/reset-password | No | Validate token, update password, revoke all sessions |
| GET | /auth/sessions | Yes | List active non-revoked sessions |
| DELETE | /auth/sessions/:id | Yes | Revoke specific session |
| DELETE | /auth/sessions | Yes | Revoke all sessions except current |
| GET | /auth/public-keys/:user_id | Yes | Return user's RSA public key |
| POST | /auth/recover | No | Return encrypted private key blob for recovery |

### Vault Items (`/vault/`)
| Method | Path | Auth | Min Role | Description |
|--------|------|------|----------|-------------|
| POST | /vault/items | Yes | — | Create item; validate fields + type-specific metadata |
| GET | /vault/items | Yes | Viewer | List with cursor pagination (default 20, max 100) |
| GET | /vault/items/:id | Yes | Viewer | Get metadata; update last_accessed_at; audit |
| PUT | /vault/items/:id | Yes | Editor | Update fields |
| DELETE | /vault/items/:id | Yes | Owner | Cascade delete with confirm:true |
| GET | /vault/search | Yes | Viewer | ILIKE on name/notes + tags array |
| GET | /vault/favorites | Yes | Viewer | Items where is_favorite=true |
| POST | /vault/items/:id/favorite | Yes | Viewer | Upsert favorite |
| DELETE | /vault/items/:id/favorite | Yes | Viewer | Remove favorite |
| GET | /vault/recent | Yes | Viewer | 20 most recently accessed |
| GET | /vault/items/:id/children | Yes | Viewer | Direct children in tree |
| GET | /vault/tree | Yes | Viewer | Recursive CTE tree (depth=1-10) |
| POST | /vault/items/:id/usage | Yes | Editor | Link to project/service |
| GET | /vault/items/:id/usage | Yes | Viewer | List usage links |
| DELETE | /vault/items/:id/usage/:uid | Yes | Editor | Remove usage link |
| POST | /vault/items/:id/invitations | Yes | Co-owner | Send share invitation |
| GET | /vault/items/:id/invitations | Yes | Co-owner | List invitations |
| DELETE | /vault/items/:id/permissions/:uid | Yes | Co-owner | Remove collaborator |

### Projects & Services
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | /projects | Create / list owned projects |
| GET/PUT/DELETE | /projects/:id | Get / update / delete project |
| GET | /projects/:id/credentials | Items linked to this project |
| POST/GET | /services | Create / list owned services |
| GET/PUT/DELETE | /services/:id | Get / update / delete service |
| GET | /services/:id/credentials | Items linked to this service |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | /invitations/:id/accept | Accept pending invitation; grants permission |
| POST | /invitations/:id/decline | Decline pending invitation |
| DELETE | /invitations/:id | Revoke invitation (inviter or Owner) |

### Security Center
| Method | Path | Description |
|--------|------|-------------|
| GET | /security/sessions | Active sessions (same as /auth/sessions) |
| GET | /security/events | 50 most recent audit events for this user |
| GET | /security/invitations | Pending invitations addressed to this user's email |
| GET | /security/shared-with-me | Items shared with user (role != owner) |

### Recovery
| Method | Path | Description |
|--------|------|-------------|
| POST | /recovery/setup | Store encrypted private key blob |
| GET | /recovery/setup | Check if recovery is configured |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | /audit/events | Paginated audit events (actor = current user) |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | /users/me | Current user profile |
| GET | /users/lookup | Look up user by email |
| GET | /users/:id | Get user profile (own only) |
