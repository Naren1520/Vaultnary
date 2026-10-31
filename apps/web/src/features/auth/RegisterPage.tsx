import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPost } from '../../services/http-client'
import { isValidEmail, isValidPassword } from '../../services/validation'
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler'
import type { RegisterRequest } from './types'

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

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={headingStyle}>Check your email</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            If an account was created, a verification link has been sent to your email address.
          </p>
          <Link to="/login" style={{ color: 'var(--color-accent)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <form onSubmit={handleSubmit} noValidate aria-label="Create account" style={cardStyle}>
        <h1 style={headingStyle}>Create account</h1>
        {globalError && <p role="alert" style={errorStyle}>{globalError}</p>}

        {(['email', 'password', 'confirm'] as const).map((field) => (
          <div key={field} style={fieldGroup}>
            <label htmlFor={field} style={labelStyle}>
              {field === 'confirm' ? 'Confirm password' : field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              id={field}
              type={field === 'email' ? 'email' : 'password'}
              autoComplete={field === 'email' ? 'email' : field === 'password' ? 'new-password' : 'new-password'}
              value={field === 'email' ? email : field === 'password' ? password : confirm}
              onChange={(e) => {
                if (field === 'email') setEmail(e.target.value)
                else if (field === 'password') setPassword(e.target.value)
                else setConfirm(e.target.value)
              }}
              aria-describedby={fieldErrors[field] ? `${field}-error` : undefined}
              aria-invalid={!!fieldErrors[field]}
              style={inputStyle}
              disabled={loading}
            />
            {fieldErrors[field] && (
              <span id={`${field}-error`} role="alert" style={fieldErrorStyle}>{fieldErrors[field]}</span>
            )}
          </div>
        ))}

        <button type="submit" disabled={loading} style={submitStyle}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-accent)' }}>Sign in</Link>
        </p>
      </form>
    </div>
  )
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)' }
const cardStyle: React.CSSProperties = { width: '100%', maxWidth: '24rem', backgroundColor: 'var(--color-bg)', border: 'var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }
const headingStyle: React.CSSProperties = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' }
const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }
const inputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-base)', width: '100%' }
const submitStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-base)', cursor: 'pointer', width: '100%' }
const errorStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }
const fieldErrorStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }
