# Threat Model

## System Overview

Vaultnary stores credentials for individuals and teams. The central security property is that the server never holds plaintext secrets or decryption keys. A full database compromise reveals only ciphertext.

---

## Assets Being Protected

| Asset | Sensitivity | Location |
|-------|------------|----------|
| Plaintext credential secrets (passwords, API keys, SSH keys) | Critical | Browser memory only (never server) |
| Master password | Critical | Never stored anywhere |
| KEK private key | Critical | Browser memory; encrypted copy in recovery_material |
| DEKs (per-item symmetric keys) | High | Browser memory; RSA-encrypted copy in credential_key_envelopes |
| Session tokens | High | HttpOnly cookie (client) + SHA-256 hash (server) |
| CSRF tokens | Medium | Browser memory (Zustand) + SHA-256 hash (server) |
| Email addresses | Medium | users table |
| Password hashes | Medium | users table (Argon2id) |
| Credential metadata (names, tags, notes) | Medium | vault_items table (plaintext) |
| Audit log | Low | audit_events table |

---

## Trust Boundaries

```
+------------------+           +------------------+          +------------------+
|  Browser         |           |  API Server       |          |  PostgreSQL       |
|  (TRUSTED)       | <--TLS--> |  (SEMI-TRUSTED)   | <-LAN->  |  (SEMI-TRUSTED)  |
|                  |           |                  |          |                  |
|  Crypto ops      |           |  No plaintext     |          |  Ciphertext blobs |
|  Key derivation  |           |  No private keys  |          |  Hashed tokens   |
|  Key storage     |           |  Hashed tokens    |          |  Audit log        |
+------------------+           +------------------+          +------------------+
                                       ^
                                       |  LAN
                                       v
                                +------------------+
                                |  Redis            |
                                |  (EPHEMERAL)      |
                                |  Rate counters    |
                                |  No secrets       |
                                +------------------+
```

The browser is the only trusted zone for secret-value operations. The server and database are treated as potentially compromised infrastructure.

---

## Threat Actors

| Actor | Capability | Primary Concern |
|-------|-----------|-----------------|
| Passive network attacker | Intercept unencrypted traffic | Session hijacking, token theft |
| Active network attacker (MITM) | Modify requests/responses | Cookie injection, response tampering |
| Compromised database | Read all stored data | Credential exposure, token reuse |
| Compromised API server | Read requests, modify responses | Session theft, serving malicious JS |
| Malicious browser extension | DOM access, XHR interception | In-memory key extraction |
| XSS attacker | Script injection into SPA | CSRF token theft, API calls |
| Insider threat (team member) | Access shared credentials | Unauthorised data access |
| Brute-force attacker | Guess passwords / tokens | Account takeover |

---

## Threat Analysis and Mitigations

### TH-01: Database breach reveals credentials
**Risk:** Attacker dumps the PostgreSQL database and reads all vault items.
**Mitigation:** All credential payloads are stored as AES-256-GCM ciphertext. The DEKs are stored RSA-encrypted. Without the user's private KEK (which is never on the server), the ciphertext is computationally unreadable.
**Residual risk:** Metadata (credential names, tags, notes) is stored in plaintext. An attacker learns what credentials exist but not their values.

### TH-02: Session token theft
**Risk:** Attacker steals a session cookie and impersonates the user.
**Mitigation:**
- Cookie is `HttpOnly` (not accessible via JavaScript)
- Cookie is `SameSite=Strict` (not sent on cross-origin requests)
- Cookie has `Secure` attribute in production (HTTPS only)
- Session token is a 128-bit random value — brute-force infeasible
- Token is stored as SHA-256 hash server-side — even if the hash is leaked, the raw token cannot be recovered without preimage attack on SHA-256
- Sessions can be revoked individually or in bulk from the Security Center

### TH-03: CSRF attack
**Risk:** Attacker tricks user's browser into making authenticated mutating requests.
**Mitigation:** Every POST/PUT/PATCH/DELETE requires `X-CSRF-Token` header. The CSRF token is a 128-bit random value stored in Zustand (in-memory, not in the DOM), SHA-256 hashed server-side. A cross-origin attacker cannot read the Zustand store.

### TH-04: Password brute-force
**Risk:** Attacker tries many passwords against the login endpoint.
**Mitigation:**
- Rate limit: 5 failed attempts per IP per 15-minute window via Redis atomic counter
- Returns 429 after limit is exceeded
- Argon2id hashing makes offline attacks (from a stolen hash) expensive: m=65536 means each guess requires 64 MiB memory and ~3 iterations

### TH-05: Account enumeration
**Risk:** Attacker probes whether an email address has an account.
**Mitigation:**
- `POST /auth/register` returns the same 200 response whether the email exists or not
- `POST /auth/login` executes a full dummy Argon2id hash when the email is not found — this equalises response time
- `POST /auth/forgot-password` executes a full dummy Argon2id hash when the email is not found
- `POST /auth/resend-verification` returns 200 regardless

### TH-06: Token replay (verification, reset)
**Risk:** Attacker reuses a verification or reset token.
**Mitigation:** Tokens are nullified (set to NULL in the database) immediately after use. A reused token returns 400 with a generic message.

### TH-07: Credential access without permission
**Risk:** Authenticated user tries to access a credential they have no permission on (guessing UUIDs).
**Mitigation:** All vault item endpoints check `credential_permissions` before returning data. A missing permission row returns 404 (not 403), so the item's existence is not leaked.

### TH-08: XSS leads to key extraction
**Risk:** Attacker injects JavaScript that reads the Zustand store and exfiltrates the private KEK.
**Mitigation:**
- Content-Security-Policy set by nginx: `script-src 'self'` — external scripts are blocked
- CSRF token is in-memory Zustand state, not localStorage/sessionStorage
- `HttpOnly` cookie cannot be read by JavaScript
- The private key is a `CryptoKey` object with `extractable: false` — it cannot be exported by `exportKey()` (only the recovery path uses PKCS#8 export deliberately)
**Residual risk:** `extractable: false` prevents `exportKey()` but does NOT prevent a compromised JavaScript context from calling `decrypt()` directly using the key reference.

### TH-09: Supply chain attack on frontend dependencies
**Mitigation:**
- `npm audit --audit-level=high` runs on every pull request (GitHub Actions)
- `cargo audit --deny warnings` runs on every pull request
- Dependencies are pinned to exact versions in package-lock.json and Cargo.lock

### TH-10: Clickjacking
**Risk:** Attacker embeds Vaultnary in an iframe and tricks the user into clicking UI elements.
**Mitigation:** nginx serves `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.

### TH-11: Session fixation
**Risk:** Attacker pre-sets a session token and tricks the user into authenticating with it.
**Mitigation:** The session token is generated fresh by the server at login time and set via `Set-Cookie`. The user cannot supply their own session token.

### TH-12: Insufficient access revocation when team member leaves
**Risk:** A former team member retains access to shared credentials.
**Mitigation:**
- Owner/Co-owner can call `DELETE /vault/items/:id/permissions/:uid` which removes both the permission row and the key envelope row
- Without the key envelope row, the former member's private key cannot decrypt the DEK even if they have the ciphertext
- Bulk "revoke all other sessions" available on logout and in Security Center

---

## Residual Risks (Not Fully Mitigated)

| Risk | Reason unmitigated |
|------|--------------------|
| Compromised browser process | If the OS process is compromised, in-memory CryptoKey objects can be read via memory inspection. No browser-based system can defend against this. |
| Malicious nginx/CDN serving modified JS | A fully compromised server can serve frontend code that exfiltrates the master password before hashing. Subresource Integrity (SRI) is not yet implemented. |
| Convincing phishing site | A look-alike domain can trick users into entering their master password. HSTS prevents protocol downgrade but not domain spoofing. |
| Lost master password AND lost recovery passphrase | No server-side recovery is possible. The vault data is permanently inaccessible. This is a deliberate tradeoff for zero-knowledge design. |

---

## Security Headers (nginx)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
