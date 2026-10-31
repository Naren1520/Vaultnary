# Vaultnary

Zero-knowledge credential manager. All encryption runs in the browser — the server stores only ciphertext.

## Stack

- **Frontend:** Vite + React 19 + TypeScript, Zustand, Web Crypto API, argon2-browser
- **Backend:** Rust + Axum + Tokio + SQLx
- **Database:** PostgreSQL 16
- **Cache:** Redis 7 (ephemeral rate-limit counters only)

## Prerequisites

- Rust stable (see `rust-toolchain.toml`)
- Node.js 22+
- Docker and Docker Compose

## Local Development

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env — at minimum set a strong SESSION_SECRET
```

### 2. Start infrastructure

```bash
docker compose -f deploy/compose.yaml up postgres redis -d
```

### 3. Run migrations

```bash
sqlx migrate run
```

### 4. Start the API

```bash
cargo run --bin api
```

### 5. Start the frontend

```bash
cd apps/web
npm install
npm run dev
```

The frontend dev server proxies `/api/v1/*` to `http://localhost:8080`.

## Production Deployment

```bash
# Set required secrets
export SESSION_SECRET=<64-byte random hex>

docker compose -f deploy/compose.yaml up --build -d
```

See `deploy/reverse-proxy/README.md` for TLS termination setup.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `REDIS_URL` | Yes | Redis connection URL |
| `PORT` | Yes | API listen port (default 8080) |
| `SESSION_SECRET` | Yes | 64-byte random hex for session signing |
| `LOG_FORMAT` | No | `json` or `human` (default: human) |
| `APP_ENV` | No | `production` enables Secure cookie attribute |
| `SMTP_HOST` | No | SMTP host for email sending |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address for verification emails |
| `VITE_API_BASE_URL` | No | Backend URL for frontend in production |

## Running Tests

```bash
# Backend unit tests
cargo test

# Frontend tests
cd apps/web && npm run test
```

## Phase Status

| Phase | Tasks | Status |
|-------|-------|--------|
| 1: Foundation | 1-9 | Complete |
| 2: Authentication | 10-16 | Complete |
| 3: Vault CRUD + Crypto | 17-23 | Complete |
| 4: Hierarchy + Projects | 24-29 | Complete |
| 5: Sharing | 30-33 | Complete |
| 6: Recovery + Security Center | 34-36 | Complete |
| 7: Polish + Deployment | 37-41 | Complete |

## Documentation

- [Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [Cryptographic Design](docs/cryptographic-design.md)
- [Permission Model](docs/permission-model.md)
- [Threat Model](docs/threat-model.md)
- [Recovery Design](docs/recovery-design.md)
