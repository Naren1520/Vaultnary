import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useToast } from '../../../components/ui/Toast'
import { apiPost } from '../../../services/http-client'
import { getErrorMessage } from '../../../services/error-handler'
import { isValidPassword } from '../../../services/validation'
import type { ChangePasswordRequest } from '../../auth/types'

export default function ChangePasswordForm() {
  const { showToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!isValidPassword(newPassword)) {
      setError('Your new password must be between 12 and 128 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setError('Your new password must be different from your current password.')
      return
    }

    setSaving(true)
    try {
      await apiPost<void>('/api/v1/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      } satisfies ChangePasswordRequest)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast({ message: 'Password changed. Other active sessions have been signed out.', type: 'success' })
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-password-form" onSubmit={handleSubmit} aria-label="Change password">
      {error && <p className="profile-alert" role="alert">{error}</p>}

      <label className="profile-field">
        <span>Current password</span>
        <input
          type={showPasswords ? 'text' : 'password'}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          disabled={saving}
        />
      </label>

      <label className="profile-field">
        <span>New password</span>
        <input
          type={showPasswords ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          disabled={saving}
          aria-describedby="profile-password-hint"
        />
      </label>

      <label className="profile-field">
        <span>Confirm new password</span>
        <input
          type={showPasswords ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          disabled={saving}
          aria-invalid={Boolean(confirmPassword) && newPassword !== confirmPassword}
        />
      </label>

      <p className="profile-field-hint" id="profile-password-hint">
        Use 12–128 characters. Changing your password signs out your other active sessions.
      </p>

      <div className="profile-form-actions">
        <button
          className="profile-secondary-button"
          type="button"
          onClick={() => setShowPasswords((visible) => !visible)}
          aria-pressed={showPasswords}
          disabled={saving}
        >
          {showPasswords ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {showPasswords ? 'Hide passwords' : 'Show passwords'}
        </button>
        <button className="profile-primary-button" type="submit" disabled={saving}>
          <KeyRound size={16} aria-hidden="true" />
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
