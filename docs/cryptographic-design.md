# Cryptographic Design

## Key Hierarchy

```
Master Password (user-typed, never sent to server)
        |
        v  Argon2id (m=65536, t=3, p=4, outputLen=32, per-user salt)
        |
   Master Key (256-bit AES-GCM CryptoKey, non-extractable in browser)
        |
        v  Encrypts
        |
   KEK Private Key (RSA-OAEP-4096, stored encrypted in recovery_material)
        |
   KEK Public Key --> uploaded to server (user_public_keys table)
        |
        |  For each vault item:
        v
   DEK (256-bit AES-GCM, random per item, extractable)
        |
        +---> Encrypts item secret payload (AES-256-GCM, unique 12-byte nonce)
        |     Stored in vault_items.encrypted_payload
        |
        +---> Encrypted with owner's KEK public key (RSA-OAEP)
              Stored in credential_key_envelopes (one row per user with access)
```

## Algorithms

| Operation | Algorithm | Parameters |
|-----------|-----------|------------|
| Password / passphrase KDF | Argon2id | m=65536, t=3, p=4, outputLen=32 |
| Symmetric encryption | AES-256-GCM | 12-byte random nonce, 16-byte auth tag |
| Key encryption | RSA-OAEP | 4096-bit, SHA-256 hash |
| Token generation | CSPRNG (OsRng) | 128 bits, hex-encoded |
| Token storage | SHA-256 | hex-encoded hash stored, plaintext discarded |
| Session cookie | HttpOnly, SameSite=Strict | Secure attribute in production |

## Nonce Strategy

Each AES-256-GCM encryption operation generates a fresh 12-byte nonce via `crypto.getRandomValues`. The nonce is prepended to the ciphertext before storage (first 12 bytes = nonce, remaining = ciphertext + 16-byte auth tag). This layout makes the nonce always co-located with the ciphertext it protects.

Nonce collision probability for 12 bytes: 2^(-32) after ~4 billion encryptions per key. Since each vault item uses a unique DEK, the per-DEK nonce space is effectively unlimited.

## Sharing Flow

1. Owner clicks "Share" and enters recipient email.
2. Frontend fetches recipient's RSA public key from `/api/v1/auth/public-keys/:userId`.
3. Frontend decrypts the item's DEK using owner's private KEK.
4. Frontend re-encrypts the DEK with the recipient's public KEK.
5. Frontend posts the re-encrypted DEK alongside the invitation to the API.
6. API stores a new `credential_key_envelopes` row for the recipient.
7. Recipient accepts invitation; API grants `credential_permissions` row.
8. Recipient's frontend uses their private KEK to unwrap the DEK and decrypt the payload.

The server sees only encrypted DEKs at every step — it never holds a plaintext DEK or private key.

## Recovery Flow

1. On vault unlock, frontend generates KEK pair if not already present.
2. User provides a recovery passphrase (12+ chars).
3. Frontend derives a 256-bit AES key from the passphrase via Argon2id with a random salt.
4. Frontend encrypts the private KEK (PKCS#8 format) with the derived key (AES-256-GCM).
5. Encrypted blob + kdf_params (including salt) are stored server-side in `recovery_material`.
6. To recover: user provides email + passphrase to `/api/v1/auth/recover`.
7. Server returns the encrypted blob; frontend re-derives the key and decrypts the private KEK locally.

## Known Limitations

- Compromised browser: if the browser is compromised (malicious extension, XSS), secrets in memory can be exfiltrated.
- Server-side JS injection: a supply-chain attack delivering malicious JS to the browser could intercept keys before encryption.
- No hardware security module: private keys reside in browser memory; CryptoKey objects marked non-extractable reduce (but don't eliminate) this risk.
- Recovery passphrase must be stored securely by the user — there is no server-side recovery without the passphrase.
