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

import ProjectsPage from './ProjectsPage'

const workspace = {
  id: 'workspace-1',
  name: 'Engineering',
  role: 'owner' as const,
}

const projects = [
  {
    id: 'project-1',
    workspace_id: workspace.id,
    name: 'Payments',
    description: 'Payment services',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'project-2',
    workspace_id: 'workspace-2',
    name: 'Other workspace project',
    description: null,
    created_at: '2026-01-02T00:00:00Z',
  },
]

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === '/api/v1/projects') return Promise.resolve({ data: projects })
      if (path === '/api/v1/workspaces') return Promise.resolve({ data: [workspace] })
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })
    mocks.apiPost.mockResolvedValue({ data: projects[0] })
  })

  it('shows only project cards belonging to the selected workspace', async () => {
    render(
      <MemoryRouter initialEntries={['/app/workspaces/workspace-1/projects']}>
        <Routes>
          <Route path="/app/workspaces/:workspaceId/projects" element={<ProjectsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: /Payments/ }))
      .toHaveAttribute('href', '/app/projects/project-1')
    expect(screen.queryByText('Other workspace project')).not.toBeInTheDocument()
  })

  it('shows the project empty state and creates a project in its workspace', async () => {
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === '/api/v1/projects') return Promise.resolve({ data: [] })
      if (path === '/api/v1/workspaces') return Promise.resolve({ data: [workspace] })
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })

    render(
      <MemoryRouter initialEntries={['/app/workspaces/workspace-1/projects']}>
        <Routes>
          <Route path="/app/workspaces/:workspaceId/projects" element={<ProjectsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status', { name: 'No projects in this workspace yet' }))
      .toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'New project' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/projects', {
        name: 'New project',
        description: null,
        workspace_id: workspace.id,
      })
    })
    expect(mocks.showToast).toHaveBeenCalledWith({
      message: 'Project created',
      type: 'success',
    })
  })
})
