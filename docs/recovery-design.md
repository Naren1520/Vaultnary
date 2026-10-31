# Recovery Design

## Overview

Recovery allows a user to regain access to their vault private key after losing their master password, provided they stored a recovery passphrase at setup time.

## Recovery Key Generation Flow

1. On first vault unlock, the frontend generates an RSA-OAEP-4096 KEK pair.
2. User is prompted to configure recovery (shown as a warning if skipped).
3. User enters a recovery passphrase (12+ characters).
4. Frontend derives a 256-bit AES-GCM key from the passphrase:
   - Algorithm: Argon2id, m=65536, t=3, p=4, outputLen=32
   - Salt: 16 random bytes from `crypto.getRandomValues`
5. Frontend exports the private KEK as PKCS#8 bytes.
6. Frontend encrypts the PKCS#8 bytes with the derived AES key (AES-256-GCM, 12-byte nonce prepended).
7. Frontend POSTs to `/api/v1/recovery/setup`:
   - `encrypted_private_key`: hex-encoded AES-GCM ciphertext
   - `integrity_tag`: last 16 bytes of ciphertext (the AES-GCM auth tag)
   - `kdf_params`: JSON with algorithm, memory_cost, time_cost, parallelism, salt (hex)
8. Server stores this in `recovery_material` (upsert — overwriting previous setup).

## Storage Format

```json
{
  "encrypted_private_key": "<hex: nonce(12) || ciphertext || tag(16)>",
  "integrity_tag": "<hex: last 16 bytes, the AES-GCM auth tag>",
  "kdf_params": {
    "algorithm": "argon2id",
    "memory_cost": 65536,
    "time_cost": 3,
    "parallelism": 4,
    "salt": "<hex: 16 random bytes>"
  }
}
```

## Recovery Procedure

1. User visits the app and cannot log in (forgotten master password).
2. User calls `POST /api/v1/auth/recover` with their email.
3. Server returns the encrypted private key blob and kdf_params. The server also sets `password_change_required = true` on the user account.
4. Frontend prompts for the recovery passphrase.
5. Frontend re-derives the AES key using kdf_params (including the stored salt).
6. Frontend decrypts the private key blob (AES-256-GCM; if the tag check fails, the passphrase is wrong).
7. Private key is restored to memory.
8. User must then set a new master password (password_change_required flag triggers this prompt).
9. New master password is hashed server-side; new KEK pair is generated; recovery setup is prompted again.

## What a Server-Side Password Reset Does Not Affect

- The encrypted credential blobs in `vault_items.encrypted_payload` are unchanged.
- The DEK envelopes in `credential_key_envelopes` are unchanged.
- After a password reset without recovery, all credential data remains encrypted under the old KEK and is inaccessible without the original private key.
- Recovery is the only path to regain access to existing credentials after a master password loss.

## Threat Considerations

- The recovery passphrase is never sent to the server.
- The server cannot decrypt the private key blob (Argon2id KDF with user-only passphrase).
- If both the master password and recovery passphrase are lost, credential data is permanently inaccessible.
