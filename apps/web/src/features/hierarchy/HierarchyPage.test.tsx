import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiGet: mocks.apiGet,
}))

import HierarchyPage from './HierarchyPage'

describe('HierarchyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiGet.mockResolvedValue({
      data: [{
        id: 'vault-1',
        name: 'Production secrets',
        workspace_name: 'Engineering',
        project_name: 'Payments',
        service_name: 'Redis API',
      }],
    })
  })

  it('explains credential hierarchy and presents service vaults as navigable cards', async () => {
    render(
      <MemoryRouter initialEntries={['/app/hierarchy']}>
        <HierarchyPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Organize related credentials' }))
      .toBeInTheDocument()
    expect(screen.getByText(/does not change your workspace, project, or service structure/i))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose a service vault' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Production secrets.*Redis API.*Engineering.*Payments/i }))
      .toHaveAttribute('href', '/app/hierarchy/vault-1')
    expect(screen.queryByText('Choose a service vault to browse its credential relationships.'))
      .not.toBeInTheDocument()
  })
})
