import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openItem, openMetadata } from '../../crypto/envelope'
import { verifyVaultArchive } from './archive'

vi.mock('../../crypto/envelope', () => ({
  openItem: vi.fn(),
  openMetadata: vi.fn(),
}))

const validItem = {
  id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
  parent_item_id: null,
  encrypted_metadata: '22'.repeat(29),
  encrypted_payload: '11'.repeat(29),
  encrypted_dek: '03'.repeat(512),
}

describe('verifyVaultArchive', () => {
  beforeEach(() => {
    vi.mocked(openItem).mockReset().mockResolvedValue({})
    vi.mocked(openMetadata).mockReset().mockResolvedValue({})
  })

  it('validates each encrypted item with the unlocked private key', async () => {
    const privateKey = {} as CryptoKey
    await expect(verifyVaultArchive({ version: 2, items: [validItem] }, privateKey))
      .resolves.toMatchObject({ version: 2, items: [validItem] })
    expect(openItem).toHaveBeenCalledWith(
      new Uint8Array(29).fill(17),
      new Uint8Array(512).fill(3),
      privateKey,
    )
    expect(openMetadata).toHaveBeenCalledWith(
      new Uint8Array(29).fill(34),
      new Uint8Array(512).fill(3),
      privateKey,
    )
  })

  it('rejects unsupported, incomplete, and unauthentic archives', async () => {
    await expect(verifyVaultArchive({ version: 1, items: [] }, {} as CryptoKey)).rejects.toThrow(
      'not a supported',
    )
    await expect(verifyVaultArchive({
      version: 2,
      items: [{ ...validItem, encrypted_dek: null }],
    }, {} as CryptoKey)).rejects.toThrow('missing its encrypted key')

    vi.mocked(openItem).mockRejectedValueOnce(new Error('authentication failed'))
    await expect(verifyVaultArchive({ version: 2, items: [validItem] }, {} as CryptoKey))
      .rejects.toThrow('authentication failed')
  })

  it('rejects invalid ciphertext encodings', async () => {
    await expect(verifyVaultArchive({
      version: 2,
      items: [{ ...validItem, encrypted_payload: 'bad!' }],
    }, {} as CryptoKey)).rejects.toThrow('invalid encrypted data')
  })
})
