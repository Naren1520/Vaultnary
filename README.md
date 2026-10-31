# Vaultnary

Zero-knowledge credential manager for individuals and teams. Every secret is encrypted in your browser before it leaves your device. The server stores only ciphertext.

---

## Tech Stack

### Backend

![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![Axum](https://img.shields.io/badge/Axum-000000?style=flat&logo=rust&logoColor=white)
![Tokio](https://img.shields.io/badge/Tokio-async-000000?style=flat&logo=rust&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white)
![SQLx](https://img.shields.io/badge/SQLx-0.7-4169E1?style=flat&logo=postgresql&logoColor=white)

### Frontend

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-7-CA4245?style=flat&logo=reactrouter&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-5-443E38?style=flat&logo=react&logoColor=white)

### Infrastructure

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-009639?style=flat&logo=nginx&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=githubactions&logoColor=white)

---

## What It Does

- Store passwords, API keys, SSH keys, database credentials, TOTP seeds, and more in one place
- Share individual credentials with teammates at specific roles (Viewer, Editor, Co-owner)
- Organise credentials into a tree hierarchy and link them to projects and environments
- View a permanent, tamper-proof audit log of every access and change
- Recover your vault if you forget your master password via a recovery passphrase

---

## How Encryption Works

1. Your master password never leaves your browser
2. The browser derives a 256-bit encryption key from your password using Argon2id
3. Each credential has its own random 256-bit encryption key (DEK)
4. The DEK encrypts the credential's secrets using AES-256-GCM
5. The DEK itself is encrypted with your RSA public key and stored server-side
6. Only your RSA private key (which never leaves your browser) can unwrap the DEK
7. When you share a credential, the DEK is re-encrypted under the recipient's public key

See [docs/cryptographic-design.md](docs/cryptographic-design.md) for the full technical detail.

---

## Project Structure

```
Vaultnary/
├── apps/
│   ├── api/              Rust + Axum backend
│   └── web/              React + TypeScript frontend
├── crates/
│   ├── shared/           AppError, UUID newtypes
│   ├── domain/           CredentialType, permissions, cycle detection
│   ├── security/         Argon2id hashing, token generation
│   ├── application/      (future use-case extraction)
│   └── persistence/      (future repository abstractions)
├── migrations/           SQL migration files (000-009)
├── deploy/               Dockerfile, compose.yaml, nginx.conf
├── tests/                Integration test stubs
└── docs/                 Full technical documentation
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| ![Rust](https://img.shields.io/badge/Rust-stable-000000?style=flat-square&logo=rust&logoColor=white) | stable | Build backend |
| ![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=nodedotjs&logoColor=white) | 22+ | Build frontend |
| ![Docker](https://img.shields.io/badge/Docker-24+-2496ED?style=flat-square&logo=docker&logoColor=white) | 24+ | Run PostgreSQL and Redis |
| sqlx-cli | 0.7 | Run database migrations |

Install sqlx-cli:
```bash
cargo install sqlx-cli --no-default-features --features postgres
```

---

## Local Development Setup

### 1. Clone and configure environment

```bash
cp .env.example .env
# Edit .env and set SESSION_SECRET, DATABASE_URL, REDIS_URL, PORT
```

Generate a session secret:
```bash
openssl rand -hex 32
```

### 2. Start PostgreSQL and Redis

```bash
docker compose -f deploy/compose.yaml up postgres redis -d
```

### 3. Run database migrations

```bash
sqlx migrate run
```

### 4. Start the API server

```bash
cargo run --bin api
```

### 5. Start the frontend dev server

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:5173` — the Vite dev server proxies all `/api/v1/*` requests to the backend automatically.

---

## Running Tests

### Backend

```bash
cargo test
```

48 unit tests — middleware, Argon2id hashing, token generation, credential type validation, cycle detection.

### Frontend

```bash
cd apps/web && npm run test
```

20 tests — HTTP client CSRF injection, 401/422/429 response handling.

---

## Production Deployment

```bash
export SESSION_SECRET=$(openssl rand -hex 32)
docker compose -f deploy/compose.yaml up --build -d
```

Services: PostgreSQL, Redis, migration runner (one-shot), API server, nginx (frontend + proxy).

For TLS termination see [deploy/reverse-proxy/README.md](deploy/reverse-proxy/README.md).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL URL: `postgres://user:pass@host:port/dbname` |
| `REDIS_URL` | Yes | Redis URL: `redis://host:port` |
| `PORT` | Yes | API listen port |
| `SESSION_SECRET` | Yes | Random secret — `openssl rand -hex 32` |
| `LOG_FORMAT` | No | `json` (production) or `human` (development) |
| `APP_ENV` | No | `production` enables `Secure` cookie attribute |
| `SMTP_HOST` | No | SMTP server — if empty, tokens are logged via tracing |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address for emails |

---

## Documentation

| Document | Contents |
|----------|---------|
| [Architecture](docs/architecture.md) | Full tech stack, directory structure, request lifecycle, all API routes |
| [Database Schema](docs/database-schema.md) | Every table, column, constraint, index with rationale |
| [Cryptographic Design](docs/cryptographic-design.md) | Algorithms, key hierarchy, create/reveal/share/recovery flows |
| [Permission Model](docs/permission-model.md) | Four roles, action matrix, invitation lifecycle, edge cases |
| [Threat Model](docs/threat-model.md) | Assets, trust boundaries, 12 threat scenarios and mitigations |
| [Recovery Design](docs/recovery-design.md) | Setup flow, recovery procedure, security analysis |

---

## Implementation Status

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 — Foundation | 1-9 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |
| 2 — Authentication | 10-16 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |
| 3 — Vault + Crypto | 17-23 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |
| 4 — Hierarchy + Projects | 24-29 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |
| 5 — Sharing | 30-33 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |
| 6 — Recovery + Security Center | 34-36 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |
| 7 — Polish + Deployment | 37-41 | ![done](https://img.shields.io/badge/status-complete-22c55e?style=flat-square) |

---

## Author

**Naren S J**

[![Email](https://img.shields.io/badge/narensonu1520%40gmail.com-EA4335?style=flat&logo=gmail&logoColor=white)](mailto:narensonu1520@gmail.com)
[![LinkedIn](https://img.shields.io/badge/narensj20-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/narensj20)
[![Portfolio](https://img.shields.io/badge/narensj.netlify.app-000000?style=flat&logo=netlify&logoColor=white)](https://narensj.netlify.app)
[![GitHub](https://img.shields.io/badge/Naren1520-181717?style=flat&logo=github&logoColor=white)](https://github.com/Naren1520)

---

## License

MIT
