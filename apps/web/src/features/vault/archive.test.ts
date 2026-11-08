import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openItem } from '../../crypto/envelope'
import { verifyVaultArchive } from './archive'

vi.mock('../../crypto/envelope', () => ({
  openItem: vi.fn(),
}))

const validItem = {
  id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
  name: 'Email',
  credential_type: 'login',
  parent_item_id: null,
  tags: [],
  notes: null,
  encrypted_payload: '0102',
  payload_metadata: null,
  encrypted_dek: '0304',
}

describe('verifyVaultArchive', () => {
  beforeEach(() => {
    vi.mocked(openItem).mockReset().mockResolvedValue({})
  })

  it('validates each encrypted item with the unlocked private key', async () => {
    const privateKey = {} as CryptoKey
    await expect(verifyVaultArchive({ version: 1, items: [validItem] }, privateKey))
      .resolves.toMatchObject({ version: 1, items: [validItem] })
    expect(openItem).toHaveBeenCalledWith(
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4]),
      privateKey,
    )
  })

  it('rejects unsupported, incomplete, and unauthentic archives', async () => {
    await expect(verifyVaultArchive({ version: 2, items: [] }, {} as CryptoKey)).rejects.toThrow(
      'not a supported',
    )
    await expect(verifyVaultArchive({
      version: 1,
      items: [{ ...validItem, encrypted_dek: null }],
    }, {} as CryptoKey)).rejects.toThrow('missing its encrypted key')

    vi.mocked(openItem).mockRejectedValueOnce(new Error('authentication failed'))
    await expect(verifyVaultArchive({ version: 1, items: [validItem] }, {} as CryptoKey))
      .rejects.toThrow('authentication failed')
  })

  it('rejects invalid ciphertext encodings', async () => {
    await expect(verifyVaultArchive({
      version: 1,
      items: [{ ...validItem, encrypted_payload: 'bad!' }],
    }, {} as CryptoKey)).rejects.toThrow('invalid encrypted data')
  })
})
