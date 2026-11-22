import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiGet: mocks.apiGet,
}))

import ProjectDetail from './ProjectDetail'

describe('ProjectDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === '/api/v1/projects/project-1') {
        return Promise.resolve({
          data: {
            id: 'project-1',
            workspace_id: 'workspace-1',
            name: 'Payments',
            description: 'Payment services',
            created_at: '2026-01-01T00:00:00Z',
          },
        })
      }
      if (path === '/api/v1/services') {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })
  })

  it('highlights the Create service action for an empty project', async () => {
    render(
      <MemoryRouter initialEntries={['/app/projects/project-1']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const createLink = await screen.findByRole('link', { name: 'Create service' })
    expect(createLink).toHaveAttribute(
      'href',
      '/app/services?project_id=project-1',
    )
    expect(createLink).toHaveClass('app-primary-action')
  })

  it('renders project services as icon-led cards with environment labels', async () => {
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === '/api/v1/projects/project-1') {
        return Promise.resolve({
          data: {
            id: 'project-1',
            workspace_id: 'workspace-1',
            name: 'Payments',
            description: 'Payment services',
            created_at: '2026-01-01T00:00:00Z',
          },
        })
      }
      if (path === '/api/v1/services') {
        return Promise.resolve({
          data: [{
            id: 'service-1',
            name: 'Redis production',
            environment: 'production',
            project_id: 'project-1',
          }],
        })
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })

    render(
      <MemoryRouter initialEntries={['/app/projects/project-1']}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const serviceCard = await screen.findByRole('link', { name: /Redis production.*production/i })
    expect(serviceCard).toHaveAttribute('href', '/app/services/service-1')
    expect(serviceCard).toHaveClass('project-service-card')
    expect(serviceCard.querySelector('.project-service-card__icon svg')).toBeInTheDocument()
  })
})
