import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

import ServicesPage from './ServicesPage'

describe('ServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === '/api/v1/services') return Promise.resolve({ data: [] })
      if (path === '/api/v1/workspaces') {
        return Promise.resolve({
          data: [{ id: 'workspace-1', name: 'Personal Workspace', role: 'owner' }],
        })
      }
      if (path === '/api/v1/projects') {
        return Promise.resolve({
          data: [{ id: 'project-1', workspace_id: 'workspace-1', name: 'test' }],
        })
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })
  })

  it('creates a service with fixed workspace and project context and no hierarchy dropdowns', async () => {
    mocks.apiPost.mockResolvedValue({
      data: {
        id: 'service-1',
        workspace_id: 'workspace-1',
        project_id: 'project-1',
        name: 'Payments API',
        environment: 'development',
        description: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    })

    render(
      <MemoryRouter initialEntries={['/app/services?project_id=project-1']}>
        <Routes>
          <Route path="/app/services" element={<ServicesPage />} />
          <Route path="/app/services/:serviceId" element={<p>Service created</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect((await screen.findAllByText('Personal Workspace')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('test').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Workspace')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Service name'), {
      target: { value: 'Payments API' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create service' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/services', {
        name: 'Payments API',
        description: null,
        environment: 'development',
        workspace_id: 'workspace-1',
        project_id: 'project-1',
      })
    })
    expect(await screen.findByText('Service created')).toBeInTheDocument()
  })
})
