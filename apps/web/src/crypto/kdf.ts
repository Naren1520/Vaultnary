import { argon2id } from '@noble/hashes/argon2.js'

/**
 * Derive a non-extractable AES-256-GCM CryptoKey from a password and salt.
 *
 * Uses @noble/hashes argon2id — pure TypeScript, no WASM required.
 * Parameters match the backend: m=65536 (64 MiB), t=3, p=4, outputLen=32.
 *
 * @param password - user's master password (plaintext)
 * @param salt     - per-user random salt (16+ bytes recommended)
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyBytes = argon2id(password, salt, {
    m: 65536,  // 64 MiB memory
    t: 3,      // 3 iterations
    p: 4,      // 4 parallelism lanes
    dkLen: 32, // 256-bit output
  })

  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
