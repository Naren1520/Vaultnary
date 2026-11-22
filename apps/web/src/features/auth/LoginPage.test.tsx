import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiPost: mocks.apiPost,
}))

import LoginPage from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiPost.mockResolvedValue({ csrf_token: 'csrf-token' })
  })

  it('takes users to workspace management after signing in', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app/workspaces" element={<p>Workspace management</p>} />
          <Route path="/app/vault" element={<p>Vaults landing</p>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in securely/i }))

    expect(await screen.findByText('Workspace management')).toBeInTheDocument()
    expect(screen.queryByText('Vaults landing')).not.toBeInTheDocument()
  })
})
