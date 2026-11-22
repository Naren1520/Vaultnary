import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVaultStore } from '../../state/vault-store'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  decryptVaultMetadata: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiGet: mocks.apiGet,
}))

vi.mock('../vault/metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../vault/metadata')>()
  return {
    ...actual,
    decryptVaultMetadata: mocks.decryptVaultMetadata,
  }
})

import VaultTree from './VaultTree'

describe('VaultTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVaultStore.setState({ privateKey: {} as CryptoKey, isUnlocked: true })
    mocks.apiGet.mockResolvedValue({
      data: [{
        id: 'credential-1',
        has_children: false,
        encrypted_metadata: 'encrypted',
        encrypted_dek: 'dek',
      }],
    })
    mocks.decryptVaultMetadata.mockResolvedValue({
      name: 'Redis API',
      credential_type: 'api_key',
      notes: 'Created using eg1@gmail.com for the production Redis instance.',
      legacy: false,
    })
  })

  it('shows the credential purpose note in the hierarchy representation', async () => {
    render(
      <MemoryRouter initialEntries={['/app/hierarchy/vault-1']}>
        <Routes>
          <Route path="/app/hierarchy/:vaultId" element={<VaultTree vaultId="vault-1" />} />
          <Route path="/app/vaults/:vaultId/items/:itemId" element={<p>Credential details</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Created using eg1@gmail.com for the production Redis instance.'))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Created using eg1@gmail.com/ })).toBeInTheDocument()
    expect(screen.getByText('1 top-level credential')).toBeInTheDocument()
  })
})
