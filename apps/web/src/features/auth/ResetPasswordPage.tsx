import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react'
import { apiPost } from '../../services/http-client'
import { getErrorMessage } from '../../services/error-handler'
import { isValidPassword } from '../../services/validation'
import type { ResetPasswordRequest } from './types'
import AuthPageLayout from './AuthPageLayout'
import './auth.css'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('This reset link is missing its token. Request a new reset email and use the latest link.')
      return
    }

    if (!isValidPassword(password)) {
      setError('Your password must be between 12 and 128 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await apiPost<void>('/api/v1/auth/reset-password', {
        token,
        new_password: password,
      } satisfies ResetPasswordRequest)
      setSubmitted(true)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout
      title="Choose a new password"
      description="Set a new password for your Vaultnary account using your password reset link."
    >
      {submitted ? (
        <div className="auth-login__form" aria-live="polite">
          <div className="auth-login__status-icon"><Check size={23} /></div>
          <div className="auth-login__form-heading">
            <span className="auth-login__form-kicker">PASSWORD UPDATED</span>
            <h2>Password reset complete</h2>
            <p>Your password has been changed. Sign in with your new password to continue.</p>
          </div>
          <Link to="/login" className="auth-login__submit auth-login__submit--link">
            <span>Go to sign in</span><ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Choose a new password"
          className="auth-login__form"
        >
          <div className="auth-login__form-heading">
            <span className="auth-login__form-kicker">ACCOUNT RECOVERY</span>
            <h2>Choose a new password</h2>
            <p>Use at least 12 characters. Your new password will replace your current sign-in password.</p>
          </div>

          {!token && (
            <div className="auth-login__alert" role="alert">
              <ShieldAlert size={16} aria-hidden="true" />
              This reset link is missing its token. Request a new reset email.
            </div>
          )}
          {error && token && <p id="reset-error" className="auth-login__alert" role="alert">{error}</p>}

          <div className="auth-login__field">
            <label htmlFor="new-password">New password</label>
            <div className="auth-login__password-wrap">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading || !token}
                aria-describedby={error ? 'reset-error' : undefined}
              />
              <button
                className="auth-login__password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={loading || !token}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="auth-login__field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <div className="auth-login__input-with-icon">
              <KeyRound size={16} aria-hidden="true" />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading || !token}
                aria-invalid={Boolean(confirmPassword) && password !== confirmPassword}
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !token} className="auth-login__submit">
            <span>{loading ? 'Updating password…' : 'Update password'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>

          <Link to="/forgot-password" className="auth-login__text-link">
            <ArrowLeft size={14} aria-hidden="true" /> Request a new reset link
          </Link>
        </form>
      )}
    </AuthPageLayout>
  )
}
