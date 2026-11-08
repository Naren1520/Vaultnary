import { openItem } from '../../crypto/envelope'

const MAX_ARCHIVE_ITEMS = 100_000
const MAX_ENCODED_BYTES = 64 * 1024

export interface VaultArchiveItem {
  id: string
  name: string
  credential_type: string
  parent_item_id: string | null
  tags: string[]
  notes: string | null
  encrypted_payload: string | null
  payload_metadata: Record<string, unknown> | null
  encrypted_dek: string | null
}

export interface VaultArchive {
  version: 1
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
    && typeof value.name === 'string'
    && typeof value.credential_type === 'string'
    && (value.parent_item_id === null || typeof value.parent_item_id === 'string')
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === 'string')
    && (value.notes === null || typeof value.notes === 'string')
    && (value.encrypted_payload === null || typeof value.encrypted_payload === 'string')
    && (value.payload_metadata === null || isRecord(value.payload_metadata))
    && (value.encrypted_dek === null || typeof value.encrypted_dek === 'string')
}

export async function verifyVaultArchive(value: unknown, privateKey: CryptoKey): Promise<VaultArchive> {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)
      || value.items.length > MAX_ARCHIVE_ITEMS || !value.items.every(isArchiveItem)) {
    throw new Error('This file is not a supported Vaultnary archive.')
  }

  const archive: VaultArchive = { version: 1, items: value.items }
  for (const item of archive.items) {
    if (item.encrypted_payload === null) continue
    if (item.encrypted_dek === null) {
      throw new Error(`Credential "${item.name}" is missing its encrypted key.`)
    }
    const encryptedPayload = decodeArchiveBytes(item.encrypted_payload)
    const encryptedDek = decodeArchiveBytes(item.encrypted_dek)
    if (encryptedPayload.length === 0 || encryptedPayload.length > MAX_ENCODED_BYTES
        || encryptedDek.length === 0 || encryptedDek.length > MAX_ENCODED_BYTES) {
      throw new Error(`Credential "${item.name}" has invalid encrypted data size.`)
    }
    const decrypted = await openItem(encryptedPayload, encryptedDek, privateKey)
    if (!isRecord(decrypted)) {
      throw new Error(`Credential "${item.name}" contains invalid encrypted data.`)
    }
  }
  return archive
}
