import { openItem, openMetadata } from '../../crypto/envelope'

const MAX_ARCHIVE_ITEMS = 100_000
const MAX_ENCODED_BYTES = 64 * 1024

export interface VaultArchiveItem {
  id: string
  parent_item_id: string | null
  encrypted_metadata: string | null
  encrypted_payload: string | null
  encrypted_dek: string | null
}

export interface VaultArchive {
  version: 2
  items: VaultArchiveItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeArchiveBytes(value: string): Uint8Array {
  if (/^(?:[0-9a-f]{2})+$/i.test(value)) {
    const bytes = new Uint8Array(value.length / 2)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
    }
    return bytes
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Archive contains invalid encrypted data.')
  }
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    throw new Error('Archive contains invalid encrypted data.')
  }
}

function isArchiveItem(value: unknown): value is VaultArchiveItem {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && (value.parent_item_id === null || typeof value.parent_item_id === 'string')
    && (value.encrypted_metadata === null || typeof value.encrypted_metadata === 'string')
    && (value.encrypted_payload === null || typeof value.encrypted_payload === 'string')
    && (value.encrypted_dek === null || typeof value.encrypted_dek === 'string')
}

export async function verifyVaultArchive(value: unknown, privateKey: CryptoKey): Promise<VaultArchive> {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.items)
      || value.items.length > MAX_ARCHIVE_ITEMS || !value.items.every(isArchiveItem)) {
    throw new Error('This file is not a supported Vaultnary archive.')
  }

  const archive: VaultArchive = { version: 2, items: value.items }
  for (const item of archive.items) {
    if (item.encrypted_metadata === null && item.encrypted_payload === null) continue
    if (item.encrypted_dek === null) {
      throw new Error('An encrypted credential is missing its encrypted key.')
    }
    const encryptedDek = decodeArchiveBytes(item.encrypted_dek)
    if (encryptedDek.length !== 512 || encryptedDek.length > MAX_ENCODED_BYTES) {
      throw new Error('An encrypted credential has an invalid encrypted key size.')
    }
    if (item.encrypted_metadata !== null) {
      const encryptedMetadata = decodeArchiveBytes(item.encrypted_metadata)
      if (encryptedMetadata.length < 29 || encryptedMetadata.length > MAX_ENCODED_BYTES) {
        throw new Error('An encrypted credential has invalid metadata size.')
      }
      await openMetadata(encryptedMetadata, encryptedDek, privateKey)
    }
    if (item.encrypted_payload !== null) {
      const encryptedPayload = decodeArchiveBytes(item.encrypted_payload)
      if (encryptedPayload.length < 29 || encryptedPayload.length > MAX_ENCODED_BYTES) {
        throw new Error('An encrypted credential has invalid payload size.')
      }
      const decrypted = await openItem(encryptedPayload, encryptedDek, privateKey)
      if (!isRecord(decrypted)) {
        throw new Error('An encrypted credential contains invalid data.')
      }
    }
  }
  return archive
}
