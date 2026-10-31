# Cryptographic Design

## Overview

Vaultnary is a zero-knowledge system. The server stores only ciphertext, encrypted key material, hashed tokens, and metadata. No plaintext secret, no private key, and no decryption key ever exists on the server at any point. All cryptographic operations run exclusively in the browser using the Web Crypto API and argon2-browser (WASM).

---

## Key Hierarchy

```
User types master password
         |
         | Argon2id (WASM, in browser)
         | params: m=65536 (64 MiB), t=3 iterations, p=4 lanes, outputLen=32 bytes
         | salt: 16 random bytes from crypto.getRandomValues (per-user, stored with recovery material)
         v
   Master Key (256-bit AES-256-GCM CryptoKey)
         |
         | Used to encrypt the KEK private key for recovery storage
         |
         | Also used as the vault "unlock" signal — held in Zustand vault-store
         v
   KEK Key Pair (RSA-OAEP, 4096-bit modulus, SHA-256 hash)
   generated once via crypto.subtle.generateKey
         |
         +-- KEK Public Key  --->  uploaded to server (user_public_keys table)
         |                         stored as PEM/SPKI string
         |
         +-- KEK Private Key -->  encrypted with Master Key (AES-256-GCM)
                                   stored in recovery_material table as ciphertext
                                   never sent to server in plaintext

         For each vault item:
         |
         v
   DEK — Data Encryption Key (random 256-bit AES-256-GCM CryptoKey)
   generated fresh for every vault item via crypto.subtle.generateKey (extractable: true)
         |
         +-- Encrypts the item's secret payload  -->  stored in vault_items.encrypted_payload
         |   (AES-256-GCM, 12-byte random nonce prepended to ciphertext)
         |
         +-- Wrapped with owner's KEK public key  -->  stored in credential_key_envelopes
             (RSA-OAEP encryption of the raw 32-byte DEK)
             One row per user who has access to the item
```

---

## Algorithms Used

### Key Derivation — Argon2id
- **Library:** argon2-browser v1.18 (WASM, runs in browser only)
- **Algorithm:** Argon2id (hybrid of Argon2i and Argon2d)
- **Parameters:** m=65536 (64 MiB memory), t=3 (iterations), p=4 (parallelism lanes), outputLen=32
- **Salt:** 16 bytes from `crypto.getRandomValues` — unique per user, stored alongside recovery material
- **Output:** 32 bytes imported as AES-256-GCM CryptoKey with `extractable: false`
- **Why Argon2id:** Resistant to both GPU brute-force (memory-hard) and side-channel cache attacks. Parameters match OWASP recommendations.

### Symmetric Encryption — AES-256-GCM
- **API:** Web Crypto API (`crypto.subtle.encrypt` / `crypto.subtle.decrypt`)
- **Key size:** 256 bits
- **Nonce:** 12 bytes from `crypto.getRandomValues`, generated fresh for every encrypt call
- **Output format:** `nonce(12 bytes) || ciphertext || auth_tag(16 bytes)` — nonce is prepended so it always travels with the ciphertext
- **Authentication:** The 16-byte GCM authentication tag is included in the ciphertext blob. Any single-byte modification to the ciphertext will cause decryption to throw — this is the integrity check.
- **Where used:** Encrypting vault item secret payloads; encrypting the KEK private key for recovery

### Asymmetric Key Encryption — RSA-OAEP
- **API:** Web Crypto API
- **Key size:** 4096-bit modulus
- **Hash:** SHA-256
- **Generated via:** `crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 4096, publicExponent: [1,0,1], hash: 'SHA-256' }, false, ['encrypt', 'decrypt'])`
- **Private key:** `extractable: false` — cannot be exported from the browser's crypto context except via `pkcs8` export for recovery purposes
- **Where used:** Wrapping (encrypting) DEKs for each user who has access to a vault item

### Token Generation — CSPRNG
- **Library:** `rand::rngs::OsRng` in the Rust backend
- **Token bits:** 128 bits minimum (32 hex characters)
- **Encoding:** lowercase hex string
- **Usage:** Session tokens, CSRF tokens, email verification tokens, password reset tokens
- **Storage:** SHA-256 hash of the token is stored in the database. The plaintext token is sent to the client once and never stored server-side.

### Password Hashing — Argon2id (Backend)
- **Library:** `argon2` crate v0.5
- **Algorithm:** Argon2id
- **Parameters:** m=65536, t=3, p=4, 16-byte random salt via `OsRng`
- **Output format:** PHC string (`$argon2id$v=19$m=65536,t=3,p=4$...`)
- **Verification:** `argon2::PasswordVerifier::verify_password` — inherently constant-time due to Argon2 output comparison

---

## Detailed Operation Flows

### Flow 1: First Vault Unlock (New User)

```
1. User registers and verifies email
2. User logs in -> receives session cookie + CSRF token from server
3. Browser prompts for master password (vault unlock screen)
4. Browser generates KEK pair:
   crypto.subtle.generateKey(RSA-OAEP-4096, non-extractable, [encrypt, decrypt])
5. Browser derives Master Key from password:
   argon2id(password, randomSalt) -> 256-bit CryptoKey
6. Browser exports KEK public key (SPKI format) -> uploads to /api/v1/users/public-key (future endpoint)
7. Browser stores privateKey and masterKey in Zustand vault-store (in-memory only)
8. Browser prompts user to configure recovery passphrase
   (RecoverySetup component in SecurityCenter)
```

### Flow 2: Create a Vault Item

```
1. User opens VaultItemForm, selects credential type (e.g. "website")
2. User fills in the fields:
   - Non-secret fields (url, username) -> payload_metadata JSON
   - Secret fields (password) -> will be encrypted
3. On submit, frontend:
   a. Fetches own RSA public key from server: GET /api/v1/auth/public-keys/:userId
   b. Generates fresh DEK: crypto.subtle.generateKey(AES-256-GCM, extractable, [encrypt, decrypt])
   c. Builds secret JSON: { "password": "hunter2" }
   d. Encrypts secret JSON with DEK (AES-256-GCM):
      nonce = crypto.getRandomValues(new Uint8Array(12))
      ciphertext = nonce || crypto.subtle.encrypt({name:'AES-GCM',iv:nonce}, dek, secretBytes)
   e. Wraps DEK with user's RSA public key (RSA-OAEP):
      encryptedDek = crypto.subtle.encrypt({name:'RSA-OAEP'}, publicKey, rawDekBytes)
   f. Base64-encodes both blobs
4. POST /api/v1/vault/items with:
   { name, credential_type, payload_metadata, encrypted_payload (base64), encrypted_dek (base64) }
5. Backend (in one transaction):
   a. Validates all fields
   b. Inserts vault_items row (stores encrypted_payload as BYTEA)
   c. Inserts credential_permissions row (role='owner')
   d. Inserts credential_key_envelopes row (stores encrypted_dek)
   e. Inserts audit_events row (action_type='item.created')
6. Returns 201 with item metadata (no encrypted_payload in response)
```

### Flow 3: Reveal a Secret Field

```
1. User clicks the eye icon on a SecretField component
2. SecretField checks vault-store: isUnlocked and privateKey present
3. If unlocked: fetches from GET /api/v1/vault/items/:id/key-envelope
   (returns encrypted_payload and encrypted_dek for this user)
4. Converts hex/base64 strings to Uint8Array
5. Decrypts DEK using private KEK:
   rawDek = crypto.subtle.decrypt({name:'RSA-OAEP'}, privateKey, encryptedDekBytes)
   dek = crypto.subtle.importKey('raw', rawDek, {name:'AES-GCM',length:256}, false, ['decrypt'])
6. Splits the encrypted payload: nonce = first 12 bytes, ciphertext = rest
7. Decrypts payload:
   plaintext = crypto.subtle.decrypt({name:'AES-GCM',iv:nonce}, dek, ciphertextWithTag)
8. Parses JSON: { "password": "hunter2" }
9. Displays plaintext for 30 seconds, then re-masks
10. Auto-clears clipboard after 30 seconds if copied
```

### Flow 4: Share a Credential

```
1. Sharer (Owner/Co-owner) opens InvitationFlow for an item
2. Enters recipient email and selects role (viewer/editor/co_owner)
3. Frontend fetches recipient user ID: GET /api/v1/users/lookup?email=...
4. Frontend fetches recipient's RSA public key: GET /api/v1/auth/public-keys/:recipientId
5. Frontend decrypts the item's DEK using sharer's private KEK (steps same as Flow 3)
6. Frontend re-encrypts the DEK with recipient's public KEK:
   encryptedDekForRecipient = crypto.subtle.encrypt({name:'RSA-OAEP'}, recipientPublicKey, rawDekBytes)
7. POST /api/v1/vault/items/:id/invitations with:
   { invitee_email, role, encrypted_dek: base64(encryptedDekForRecipient) }
8. Backend creates share_invitations row (state='pending', expires_at=now+7days)
9. If recipient user exists in DB: backend creates credential_key_envelopes row for recipient
10. Recipient accepts via POST /api/v1/invitations/:id/accept
11. Backend (in one transaction):
    a. Sets invitation state='accepted'
    b. Inserts credential_permissions row for recipient with the specified role
12. Recipient can now fetch the item; their encrypted_dek is in credential_key_envelopes
```

### Flow 5: Recovery

```
1. User sets up recovery passphrase (RecoverySetup component):
   a. User enters a passphrase (12+ characters)
   b. Browser generates 16-byte random salt
   c. Derives AES key from passphrase: argon2id(passphrase, salt, m=65536, t=3, p=4)
   d. Exports private KEK as PKCS#8 bytes:
      crypto.subtle.exportKey('pkcs8', privateKey) -> ArrayBuffer
   e. Encrypts PKCS#8 bytes with derived AES key (AES-256-GCM):
      nonce || ciphertext = encrypt(derivedKey, pkcs8Bytes)
   f. POST /api/v1/recovery/setup:
      { encrypted_private_key: hex(ciphertext), integrity_tag: hex(last16bytes), kdf_params: {salt,...} }
   g. Backend upserts recovery_material table row

2. Recovery procedure (lost master password):
   a. User visits recovery page, enters email
   b. POST /api/v1/auth/recover with { email }
   c. Backend returns encrypted_private_key blob + kdf_params from recovery_material
   d. Backend sets password_change_required=true on user account
   e. Frontend prompts for recovery passphrase
   f. Browser re-derives AES key using kdf_params.salt
   g. Browser decrypts the blob:
      pkcs8Bytes = AES-GCM-decrypt(derivedKey, ciphertext)
      If auth tag check fails -> wrong passphrase, prompt again
   h. Browser imports private key:
      privateKey = crypto.subtle.importKey('pkcs8', pkcs8Bytes, RSA-OAEP, false, ['decrypt'])
   i. Private key is restored to vault-store
   j. User must immediately set a new master password
```

---

## Nonce and Salt Strategy

| Operation | Nonce/Salt | Size | Source | Stored with |
|-----------|-----------|------|--------|-------------|
| AES-GCM encrypt payload | Nonce | 12 bytes | crypto.getRandomValues | Prepended to ciphertext |
| AES-GCM encrypt private key (recovery) | Nonce | 12 bytes | crypto.getRandomValues | Prepended to ciphertext |
| Argon2id (master password) | Salt | 16 bytes | crypto.getRandomValues | kdf_params JSON in recovery_material |
| Argon2id (backend password hash) | Salt | 16 bytes | OsRng | PHC string in users.password_hash |
| Session token | N/A | 128 bits | OsRng | SHA-256 hash in auth_sessions.token_hash |
| CSRF token | N/A | 128 bits | OsRng | SHA-256 hash in auth_sessions.csrf_token_hash |

---

## What the Server Stores

| Table | Sensitive data stored | Form |
|-------|----------------------|------|
| users | password_hash | Argon2id PHC string (never plaintext) |
| users | email_verify_token_hash | SHA-256 hex hash |
| users | password_reset_token_hash | SHA-256 hex hash |
| auth_sessions | token_hash | SHA-256 hex hash |
| auth_sessions | csrf_token_hash | SHA-256 hex hash |
| vault_items | encrypted_payload | AES-256-GCM ciphertext (BYTEA) |
| credential_key_envelopes | encrypted_dek | RSA-OAEP wrapped 32-byte key (BYTEA) |
| user_public_keys | public_key | RSA public key in PEM/SPKI (readable, not secret) |
| recovery_material | encrypted_private_key | AES-256-GCM encrypted PKCS#8 (BYTEA) |

The server **never** stores: plaintext passwords, plaintext secrets, DEKs in plaintext, or KEK private keys in plaintext.

---

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Confidentiality of credentials | AES-256-GCM with unique DEK per item |
| Integrity of credentials | GCM authentication tag; any modification causes decryption failure |
| Confidentiality of DEKs | RSA-OAEP-4096 per-user key envelopes |
| No server knowledge | Zero-knowledge design; server only holds ciphertext |
| Forward secrecy of sessions | Sessions are revoked on logout; tokens are random 128-bit values |
| Timing-safe authentication | Argon2id verify is inherently constant-time; dummy hash on missing email |
| CSRF protection | Per-session 128-bit token validated on all mutations |
| Brute-force protection | Argon2id (slow by design); rate limiting (5 attempts/IP/15min for login) |
