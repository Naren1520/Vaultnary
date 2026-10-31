# Recovery Design

## The Problem

Vaultnary uses zero-knowledge encryption. Your master password is the root of your entire key hierarchy. If you forget it, the server cannot help you — it does not know your password and cannot decrypt your private key. Without recovery, losing your master password means permanently losing all your credentials.

Recovery solves this by letting you create an encrypted backup of your private key, protected by a separate recovery passphrase that only you know. The backup is stored on the server but is computationally unreadable without the passphrase.

---

## Key Concepts

| Term | Meaning |
|------|---------|
| Master password | The password you type to unlock your vault. Never stored. Derives your Master Key. |
| Master Key | 256-bit AES-GCM key derived from your master password via Argon2id. Held in browser memory only. |
| KEK | Key Encryption Key. An RSA-OAEP-4096 key pair. The public key encrypts DEKs; the private key decrypts them. |
| DEK | Data Encryption Key. A random 256-bit AES key unique to each vault item. Encrypts the item's secret payload. |
| Recovery passphrase | A separate passphrase (12+ characters) used only for recovery. Completely independent of your master password. |
| Recovery Key | 256-bit AES-GCM key derived from your recovery passphrase via Argon2id. Never stored — re-derived on demand. |
| Encrypted private key blob | Your KEK private key encrypted with your Recovery Key. Stored in `recovery_material` on the server. |

---

## Recovery Setup Flow

This happens in the `RecoverySetup` component after a user first unlocks their vault.

```
Step 1: User opens Security Center -> Recovery section
        Status shows "Recovery not configured"

Step 2: User clicks "Set up recovery"
        A modal appears prompting for a recovery passphrase (12+ chars)

Step 3: User enters and confirms the recovery passphrase

Step 4: Browser generates 16 random bytes for the KDF salt:
        salt = crypto.getRandomValues(new Uint8Array(16))

Step 5: Browser derives a 256-bit Recovery Key from the passphrase:
        recoveryKey = argon2id(passphrase, salt, m=65536, t=3, p=4, outputLen=32)
        -> Returns an AES-256-GCM CryptoKey (non-extractable)

Step 6: Browser exports the KEK private key as PKCS#8 bytes:
        pkcs8Bytes = crypto.subtle.exportKey('pkcs8', privateKey)
        (This is only possible because the key was generated with a flag allowing pkcs8 export for recovery)

Step 7: Browser encrypts the PKCS#8 bytes with the Recovery Key:
        nonce = crypto.getRandomValues(new Uint8Array(12))
        ciphertext = nonce || crypto.subtle.encrypt({name:'AES-GCM', iv:nonce}, recoveryKey, pkcs8Bytes)
        integrityTag = last 16 bytes of ciphertext (the AES-GCM authentication tag)

Step 8: Browser calls POST /api/v1/recovery/setup with:
        {
          encrypted_private_key: hex(ciphertext),
          integrity_tag: hex(integrityTag),
          kdf_params: {
            algorithm: "argon2id",
            memory_cost: 65536,
            time_cost: 3,
            parallelism: 4,
            salt: hex(salt)
          }
        }

Step 9: Server upserts a row in recovery_material:
        user_id, encrypted_private_key (BYTEA), integrity_tag (BYTEA), kdf_params (JSONB)

Step 10: Modal closes, status shows "Recovery configured"
```

The recovery passphrase itself is NEVER sent to the server. Only the ciphertext blob and the KDF parameters (including the salt, which is not secret) are stored.

---

## Recovery Procedure Flow

Used when a user has forgotten their master password and needs to regain vault access.

```
Step 1: User visits the app
        They cannot log in with their old password

Step 2: If they still have their current session (unusual case), they use the recovery
        passphrase to re-derive their private key and immediately set a new master password.

        More common: user has completely lost access.

Step 3: User calls POST /api/v1/auth/recover with { email: "user@example.com" }

Step 4: Server:
        a. Looks up recovery_material by email (JOIN with users)
        b. Returns the encrypted_private_key blob and kdf_params
        c. Sets users.password_change_required = true
        d. Inserts audit_events row: action_type = 'user.recovery_used'

Step 5: Browser prompts user for their recovery passphrase

Step 6: Browser re-derives the Recovery Key using the stored kdf_params.salt:
        recoveryKey = argon2id(passphrase, hex_decode(kdf_params.salt), same params)

Step 7: Browser splits the ciphertext:
        nonce = ciphertext[0..12]
        ciphertextWithTag = ciphertext[12..]

Step 8: Browser decrypts:
        pkcs8Bytes = crypto.subtle.decrypt({name:'AES-GCM', iv:nonce}, recoveryKey, ciphertextWithTag)
        
        If the AES-GCM authentication tag check fails (wrong passphrase, corrupted blob):
        -> Decryption throws a DOMException
        -> Browser shows "Incorrect recovery passphrase, try again"

Step 9: Browser imports the private key:
        privateKey = crypto.subtle.importKey('pkcs8', pkcs8Bytes, {name:'RSA-OAEP',hash:'SHA-256'}, false, ['decrypt'])

Step 10: privateKey is stored in Zustand vault-store
         Vault is now unlocked — user can access all their credentials again

Step 11: Browser enforces password_change_required:
         User is prompted to set a new master password immediately
         A new Argon2id hash is sent to POST /auth/change-password

Step 12: User is prompted to run recovery setup again (create a new encrypted blob
         under the new or same recovery passphrase)
```

---

## What Recovery Can and Cannot Do

### Recovery CAN:
- Restore access to the private KEK after forgetting the master password
- Allow decryption of all DEKs the user had access to (since their RSA private key is restored)
- Allow reading all vault items where a `credential_key_envelopes` row exists for this user

### Recovery CANNOT:
- Restore access to credentials that were never shared with the user
- Work without the recovery passphrase — the blob on the server is computationally unreadable without it
- Bypass the Argon2id computation — re-deriving the key takes ~2-3 seconds per attempt (memory-hard)
- Recover a vault if BOTH master password AND recovery passphrase are lost — the data is permanently inaccessible

---

## Storage Format

The `recovery_material` table stores:

```json
{
  "encrypted_private_key": "3f2a8b...(hex: nonce(12) + ciphertext + tag(16))",
  "integrity_tag": "a1b2c3...(hex: last 16 bytes, the AES-GCM auth tag)",
  "kdf_params": {
    "algorithm": "argon2id",
    "memory_cost": 65536,
    "time_cost": 3,
    "parallelism": 4,
    "salt": "7f3a9c...(hex: 16 random bytes)"
  }
}
```

- `encrypted_private_key`: The full AES-256-GCM output — nonce prepended, auth tag appended
- `integrity_tag`: The last 16 bytes of the ciphertext — same as the AES-GCM tag. Redundant but makes integrity checking explicit without re-parsing
- `kdf_params.salt`: Random per-setup, stored openly (like a password hash salt). Not secret — the security comes from the passphrase, not the salt

---

## Security Analysis

| Attack | Defence |
|--------|---------|
| Server database leaked — attacker reads encrypted_private_key | Cannot decrypt without recovery passphrase. Argon2id with m=65536 means ~64MiB RAM per guess. |
| Attacker tries every common passphrase | Argon2id makes each guess expensive. 10,000 guesses/sec on a GPU requires 640 GB RAM simultaneously. |
| Attacker has both ciphertext AND can guess fast | Salt is per-user, random 16 bytes. Pre-computation (rainbow tables) is infeasible. |
| Wrong passphrase on decryption attempt | AES-GCM auth tag check rejects any wrong key immediately — no information leakage. |
| Attacker modifies the encrypted blob on server | AES-GCM authentication tag catches any modification — decryption throws. |

---

## Operational Notes

- Recovery setup should be done immediately after first vault unlock
- The recovery passphrase should be different from the master password
- The recovery passphrase should be stored in a physically secure location (printed paper, physical vault)
- Recovery should be re-configured after changing the master password (new KEK pair generation)
- The server marks `password_change_required = true` after recovery — the user must set a new password before normal vault use resumes
