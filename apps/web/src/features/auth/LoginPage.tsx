import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../state/auth-store'
import { apiPost } from '../../services/http-client'
import { isValidEmail, isValidPassword } from '../../services/validation'
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler'
import type { LoginRequest, LoginResponse } from './types'

export default function LoginPage() {
  const navigate = useNavigate()
  const setCsrfToken = useAuthStore((s) => s.setCsrfToken)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [rateLimitMsg, setRateLimitMsg] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    const errs: Record<string, string> = {}
    if (!isValidEmail(email)) errs.email = 'Enter a valid email address.'
    if (!isValidPassword(password)) errs.password = 'Password must be 12–128 characters.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError('')
    setRateLimitMsg('')

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setLoading(true)

    try {
      const res = await apiPost<LoginResponse>('/api/v1/auth/login', {
        email,
        password,
      } satisfies LoginRequest)
      setCsrfToken(res.csrf_token)
      navigate('/app/vault', { replace: true })
    } catch (err) {
      if (err instanceof ValidationError) {
        const mapped: Record<string, string> = {}
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.rule
        setFieldErrors(mapped)
      } else if (err instanceof RateLimitError) {
        const secs = err.retryAfterSeconds
        setRateLimitMsg(
          secs ? `Too many attempts. Try again in ${secs}s.` : 'Too many attempts. Try again later.',
        )
      } else {
        setGlobalError(getErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Sign in"
        style={cardStyle}
      >
        <h1 style={headingStyle}>Sign in</h1>

        {globalError && (
          <p role="alert" style={errorStyle}>{globalError}</p>
        )}
        {rateLimitMsg && (
          <p role="alert" style={rateLimitStyle}>{rateLimitMsg}</p>
        )}

        <div style={fieldGroup}>
          <label htmlFor="email" style={labelStyle}>Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            aria-invalid={!!fieldErrors.email}
            style={inputStyle}
            disabled={loading}
          />
          {fieldErrors.email && (
            <span id="email-error" role="alert" style={fieldErrorStyle}>{fieldErrors.email}</span>
          )}
        </div>

        <div style={fieldGroup}>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            aria-invalid={!!fieldErrors.password}
            style={inputStyle}
            disabled={loading}
          />
          {fieldErrors.password && (
            <span id="password-error" role="alert" style={fieldErrorStyle}>{fieldErrors.password}</span>
          )}
        </div>

        <button type="submit" disabled={loading} style={submitStyle}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-3)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--color-accent)' }}>Register</Link>
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          <Link to="/forgot-password" style={{ color: 'var(--color-accent)' }}>Forgot password?</Link>
        </p>
      </form>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--color-bg-subtle)',
  padding: 'var(--space-4)',
}
const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '24rem',
  backgroundColor: 'var(--color-bg)',
  border: 'var(--border-card)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-8)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
}
const headingStyle: React.CSSProperties = {
  fontSize: 'var(--text-xl)',
  fontWeight: 'var(--font-weight-semibold)',
  textAlign: 'center',
}
const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }
const inputStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  border: 'var(--border-input)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-base)',
  width: '100%',
}
const submitStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  backgroundColor: 'var(--color-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 'var(--text-base)',
  cursor: 'pointer',
  width: '100%',
}
const errorStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'rgba(220,38,38,0.08)',
  border: '1px solid var(--color-danger)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-danger)',
  fontSize: 'var(--text-sm)',
}
const rateLimitStyle: React.CSSProperties = { ...errorStyle, borderColor: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
const fieldErrorStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }
