import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../state/auth-store'
import { useVaultStore } from '../../state/vault-store'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiDelete: mocks.apiDelete,
}))

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

import ProfilePage from './ProfilePage'

function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={['/app/profile']}>
      <Routes>
        <Route path="/app/profile" element={<ProfilePage />} />
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().clearCsrfToken()
    useVaultStore.getState().lockVault()
    mocks.apiGet.mockImplementation((path: string) => Promise.resolve(
      path === '/api/v1/users/me'
        ? { data: { id: 'user-1', email: 'person@example.com', email_verified: true } }
        : {
            data: {
              email: 'person@example.com',
              deletion_scope: {
                workspace_count: 0,
                personal_credentials_to_delete: 0,
                shared_credentials_to_transfer: 0,
                shared_credentials_you_access: 0,
                projects_to_remove_or_transfer: 0,
                services_to_remove_or_transfer: 0,
                collaborators_to_notify: 0,
              },
              workspaces: [],
              owned_credentials: [],
            },
          },
    ))
    mocks.apiPost.mockResolvedValue(undefined)
    mocks.apiDelete.mockResolvedValue({ data: { deleted: true } })
  })

  it('loads account details and email verification status', async () => {
    renderProfilePage()

    expect(await screen.findByText('person@example.com')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/v1/users/me', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }))
  })

  it('validates password length and matching confirmation before sending a request', async () => {
    renderProfilePage()

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'current-password' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'does-not-match' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('between 12 and 128 characters')
    expect(mocks.apiPost).not.toHaveBeenCalled()
  })

  it('changes the password and confirms success', async () => {
    renderProfilePage()
    const newPassword = 'a-strong-new-password'

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'current-password' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: newPassword },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: newPassword },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/auth/change-password', {
        current_password: 'current-password',
        new_password: newPassword,
      })
    })
    expect(mocks.showToast).toHaveBeenCalledWith({
      message: 'Password changed. Other active sessions have been signed out.',
      type: 'success',
    })
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('keeps the user signed in and reports an error if logout fails', async () => {
    mocks.apiPost.mockRejectedValueOnce(new Error('Unable to sign out'))
    renderProfilePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign out')
    expect(screen.queryByRole('heading', { name: 'Login page' })).not.toBeInTheDocument()
  })

  it('locks the vault, clears the CSRF token, and navigates to login after logout', async () => {
    useAuthStore.getState().setCsrfToken('csrf-token')
    useVaultStore.setState({ isUnlocked: true })
    renderProfilePage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument()
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/auth/logout')
    expect(useAuthStore.getState().csrfToken).toBeNull()
    expect(useVaultStore.getState().isUnlocked).toBe(false)
  })
})
