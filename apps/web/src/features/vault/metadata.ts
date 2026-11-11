import { openMetadata } from '../../crypto/envelope'
import type { CredentialType } from '../../components/ui/CredentialBadge'

const CREDENTIAL_TYPES = new Set<CredentialType>([
  'email',
  'website',
  'database',
  'api_key',
  'token',
  'ssh',
  'service_account',
  'totp',
  'recovery_code',
  'custom',
])

export interface EncryptedVaultItem {
  id: string
  name?: string
  credential_type?: string
  tags?: string[]
  parent_item_id?: string | null
  last_accessed_at?: string | null
  created_at?: string
  updated_at?: string
  encrypted_metadata?: string | null
  encrypted_payload?: string | null
  encrypted_dek?: string | null
  metadata_locked?: boolean
  is_favorite?: boolean
}

export interface DecryptedVaultMetadata {
  name: string
  credential_type: CredentialType
  tags: string[]
  notes: string | null
  payload_metadata: Record<string, unknown> | null
}

export type VaultItem = Omit<
  EncryptedVaultItem,
  keyof DecryptedVaultMetadata
> & DecryptedVaultMetadata & {
  last_accessed_at: string | null
  created_at: string
  updated_at: string
  legacy: boolean
}

export function decodeHex(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error('Encrypted credential data is invalid.')
  }
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}

export async function decryptVaultMetadata(
  item: EncryptedVaultItem,
  privateKey: CryptoKey,
): Promise<VaultItem> {
  if (!item.encrypted_metadata || !item.encrypted_dek) {
    return {
      ...item,
      last_accessed_at: item.last_accessed_at ?? null,
      created_at: item.created_at ?? '',
      updated_at: item.updated_at ?? '',
      name: 'Legacy credential',
      credential_type: 'custom',
      tags: [],
      notes: null,
      payload_metadata: null,
      legacy: true,
    }
  }

  const metadata = await openMetadata(
    decodeHex(item.encrypted_metadata),
    decodeHex(item.encrypted_dek),
    privateKey,
  )
  const { name, credential_type: credentialType, tags, notes, payload_metadata: payloadMetadata } =
    metadata
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof credentialType !== 'string' ||
    !CREDENTIAL_TYPES.has(credentialType as CredentialType) ||
    !Array.isArray(tags) ||
    !tags.every((tag): tag is string => typeof tag === 'string') ||
    (notes !== null && notes !== undefined && typeof notes !== 'string') ||
    (payloadMetadata !== null &&
      payloadMetadata !== undefined &&
      (typeof payloadMetadata !== 'object' ||
        Array.isArray(payloadMetadata)))
  ) {
    throw new Error('Decrypted credential metadata is invalid.')
  }

  return {
    ...item,
    last_accessed_at: item.last_accessed_at ?? null,
    created_at: item.created_at ?? '',
    updated_at: item.updated_at ?? '',
    name,
    credential_type: credentialType as CredentialType,
    tags,
    notes: typeof notes === 'string' ? notes : null,
    payload_metadata:
      payloadMetadata && typeof payloadMetadata === 'object'
        ? (payloadMetadata as Record<string, unknown>)
        : null,
    legacy: false,
  }
}
