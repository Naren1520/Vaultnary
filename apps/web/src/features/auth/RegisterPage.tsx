import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, UserRoundPlus } from 'lucide-react'
import { apiPost } from '../../services/http-client'
import { isValidEmail, isValidPassword } from '../../services/validation'
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler'
import type { RegisterRequest } from './types'
import AuthPageLayout from './AuthPageLayout'
import './auth.css'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function validate() {
    const errs: Record<string, string> = {}
    if (!isValidEmail(email)) errs.email = 'Enter a valid email address.'
    if (!isValidPassword(password)) errs.password = 'Password must be 12–128 characters.'
    if (password !== confirm) errs.confirm = 'Passwords do not match.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setLoading(true)
    try {
      await apiPost('/api/v1/auth/register', { email, password } satisfies RegisterRequest)
      setSuccess(true)
    } catch (err) {
      if (err instanceof ValidationError) {
        const mapped: Record<string, string> = {}
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.rule
        setFieldErrors(mapped)
      } else if (err instanceof RateLimitError) {
        setGlobalError('Too many attempts. Please try again later.')
      } else {
        setGlobalError(getErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout
      title="Create your account"
      description="Create a Vaultnary account to organize team credentials and manage shared access."
    >
      {success ? (
        <div className="auth-login__form" aria-labelledby="register-success-title">
          <div className="auth-login__status-icon"><Check size={23} /></div>
          <div className="auth-login__form-heading">
            <span className="auth-login__form-kicker">ONE MORE STEP</span>
            <h2 id="register-success-title">Check your email</h2>
            <p>If an account was created, a verification link has been sent to your email address.</p>
          </div>
          <Link to="/login" className="auth-login__submit auth-login__submit--link">
            <span>Back to sign in</span><ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate aria-label="Create account" className="auth-login__form">
          <div className="auth-login__form-heading">
            <span className="auth-login__form-kicker">CREATE YOUR SECURE WORKSPACE</span>
            <h2>Create account</h2>
            <p>Set up your account to start organizing team access.</p>
          </div>
          {globalError && <p role="alert" className="auth-login__alert">{globalError}</p>}

          <div className="auth-login__field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              aria-invalid={!!fieldErrors.email}
              disabled={loading}
            />
            {fieldErrors.email && <span id="email-error" role="alert" className="auth-login__field-error">{fieldErrors.email}</span>}
          </div>

          <div className="auth-login__field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={fieldErrors.password ? 'password-hint password-error' : 'password-hint'}
              aria-invalid={!!fieldErrors.password}
              disabled={loading}
            />
            <span id="password-hint" className="auth-login__field-hint">Use 12–128 characters.</span>
            {fieldErrors.password && <span id="password-error" role="alert" className="auth-login__field-error">{fieldErrors.password}</span>}
          </div>

          <div className="auth-login__field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined}
              aria-invalid={!!fieldErrors.confirm}
              disabled={loading}
            />
            {fieldErrors.confirm && <span id="confirm-error" role="alert" className="auth-login__field-error">{fieldErrors.confirm}</span>}
          </div>

          <button type="submit" disabled={loading} className="auth-login__submit">
            <span>{loading ? 'Creating account…' : 'Create secure account'}</span>
            <UserRoundPlus size={17} aria-hidden="true" />
          </button>

          <p className="auth-login__legal">
            By creating an account, you acknowledge the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Notice</Link>.
          </p>
          <p className="auth-login__register">
            Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link>
          </p>
        </form>
      )}
    </AuthPageLayout>
  )
}
