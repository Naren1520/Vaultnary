# Threat Model

## Assets Protected

- Plaintext credential secrets (passwords, API keys, SSH keys, TOTP seeds)
- User master password and derived encryption keys
- Session tokens and CSRF tokens
- KEK private keys

## Trust Boundaries

1. **Browser (trusted):** User's own browser is trusted. Keys reside here in memory.
2. **API server (semi-trusted):** Stores encrypted blobs and metadata; never sees plaintext secrets or private keys.
3. **Database (semi-trusted):** Stores ciphertext, hashed tokens, audit records.
4. **Redis (semi-trusted):** Stores ephemeral rate-limit counters only; no sensitive data.
5. **Network (untrusted):** All traffic goes over TLS 1.2+.

## Threat Actors

| Actor | Capability |
|-------|-----------|
| Passive network attacker | Intercept unencrypted traffic |
| Active network attacker | MITM, replay attacks |
| Compromised database | Read all stored data |
| Compromised API server | Intercept requests, modify responses |
| Malicious browser extension | Access DOM, network requests |
| XSS attacker | Inject scripts into the SPA |

## Mitigations Implemented

| Threat | Mitigation |
|--------|-----------|
| Credential theft via DB compromise | All secrets stored encrypted; server never holds plaintext |
| Session hijacking | HttpOnly SameSite=Strict cookie; token stored as SHA-256 hash |
| CSRF | Per-session CSRF token validated on all mutating requests |
| Brute-force login | Argon2id slow hash; rate limit 5 attempts/IP/15 min |
| Account enumeration | Same response time and body for existing vs non-existent emails |
| Token replay | Session tokens are single-use hashes; revocation checked on every request |
| Timing attacks | Constant-time password comparison; dummy hash on missing email |
| Clickjacking | X-Frame-Options: DENY; frame-ancestors 'none' CSP directive |
| MIME sniffing | X-Content-Type-Options: nosniff |
| Information leakage | Stack traces suppressed in production; 404 instead of 403 for missing items |
| Supply chain | npm audit and cargo audit in CI; exact dependency versions pinned |

## Unresolved Risks

- **Compromised browser:** If the browser process is compromised, in-memory keys can be extracted. Mitigation: vault auto-locks on session expiry and on logout.
- **Server-side JS injection:** A supply-chain attack on the frontend JS bundle could intercept keys. Mitigation: Content-Security-Policy restricts script sources to 'self'; Subresource Integrity (SRI) not yet implemented.
- **Phishing:** Users may be tricked into entering their master password on a fake site. Mitigation: HSTS header prevents protocol downgrade; no mitigation for convincing look-alike domains.
- **Malicious recovery server:** If the server is fully compromised, an attacker could serve a modified frontend that exfiltrates the master password. This is inherent to web-based zero-knowledge systems.
