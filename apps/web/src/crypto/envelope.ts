/**
 * Envelope encryption helpers.
 *
 * Each vault item has its own random DEK (Data Encryption Key).
 * The DEK encrypts the item secret (AES-256-GCM).
 * The DEK itself is encrypted with the owner's RSA public key (KEK) and stored
 * server-side in credential_key_envelopes.
 *
 * When sharing, the DEK is re-encrypted under the recipient's public key and
 * a new credential_key_envelopes row is created for them.
 */

import { encrypt, decrypt } from './symmetric'
import { encryptDek, decryptDek } from './asymmetric'

/** Generate a random AES-256-GCM DEK */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can wrap it
    ['encrypt', 'decrypt'],
  )
}

export interface SealedItem {
  /** AES-256-GCM ciphertext: nonce(12) || ciphertext || tag(16) */
  encryptedPayload: Uint8Array
  /** Encrypted credential metadata, readable only by holders of the wrapped DEK. */
  encryptedMetadata: Uint8Array
  /** RSA-OAEP wrapped DEK */
  encryptedDek: Uint8Array
}

/**
 * Seal a secret object for a vault item.
 *
 * 1. Generates a fresh DEK
 * 2. Encrypts the JSON-serialised secret with the DEK (AES-256-GCM)
 * 3. Wraps the DEK with the owner's public KEK (RSA-OAEP)
 *
 * The caller uploads both blobs to the server -the server never sees
 * either in plaintext.
 */
export async function sealItem(
  secret: Record<string, unknown>,
  metadata: Record<string, unknown>,
  ownerPublicKey: CryptoKey,
): Promise<SealedItem> {
  const dek = await generateDek()
  const plaintext = new TextEncoder().encode(JSON.stringify(secret))
  const encryptedPayload = await encrypt(dek, plaintext)
  const encryptedMetadata = await encrypt(
    dek,
    new TextEncoder().encode(JSON.stringify(metadata)),
  )
  const encryptedDek = await encryptDek(dek, ownerPublicKey)
  return { encryptedPayload, encryptedMetadata, encryptedDek }
}

export async function sealItemWithDek(
  secret: Record<string, unknown>,
  metadata: Record<string, unknown>,
  dek: CryptoKey,
): Promise<Omit<SealedItem, 'encryptedDek'>> {
  const [encryptedPayload, encryptedMetadata] = await Promise.all([
    encrypt(dek, new TextEncoder().encode(JSON.stringify(secret))),
    encrypt(dek, new TextEncoder().encode(JSON.stringify(metadata))),
  ])
  return { encryptedPayload, encryptedMetadata }
}

export async function openMetadata(
  encryptedMetadata: Uint8Array,
  encryptedDek: Uint8Array,
  privateKey: CryptoKey,
): Promise<Record<string, unknown>> {
  const dek = await decryptDek(encryptedDek, privateKey)
  const plaintext = await decrypt(dek, encryptedMetadata)
  const value: unknown = JSON.parse(new TextDecoder().decode(plaintext))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Credential metadata is invalid.')
  }
  return value as Record<string, unknown>
}

/**
 * Unseal a vault item secret.
 *
 * 1. Unwraps the DEK using the user's private KEK (RSA-OAEP)
 * 2. Decrypts the payload with the DEK (AES-256-GCM)
 * 3. Parses and returns the JSON object
 */
export async function openItem(
  encryptedPayload: Uint8Array,
  encryptedDek: Uint8Array,
  privateKey: CryptoKey,
): Promise<Record<string, unknown>> {
  const dek = await decryptDek(encryptedDek, privateKey)
  const plaintext = await decrypt(dek, encryptedPayload)
  const json = new TextDecoder().decode(plaintext)
  return JSON.parse(json) as Record<string, unknown>
}
