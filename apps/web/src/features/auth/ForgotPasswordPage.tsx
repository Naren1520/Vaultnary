import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPost } from '../../services/http-client'
import { isValidEmail } from '../../services/validation'
import type { ForgotPasswordRequest } from './types'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) { setEmailError('Enter a valid email address.'); return }
    setEmailError('')
    setLoading(true)
    try {
      await apiPost('/api/v1/auth/forgot-password', { email } satisfies ForgotPasswordRequest)
    } catch {
      // Always show the same message regardless of outcome (no account enumeration)
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Reset password</h1>
        {submitted ? (
          <>
            <p style={mutedStyle}>
              If an account exists for that address, a reset link has been sent.
            </p>
            <Link to="/login" style={linkStyle}>Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={fieldGroup}>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={!!emailError}
                style={inputStyle}
                disabled={loading}
              />
              {emailError && <span id="email-error" role="alert" style={fieldErrorStyle}>{emailError}</span>}
            </div>
            <button type="submit" disabled={loading} style={submitStyle}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/login" style={{ ...linkStyle, textAlign: 'center' }}>Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)' }
const cardStyle: React.CSSProperties = { width: '100%', maxWidth: '24rem', backgroundColor: 'var(--color-bg)', border: 'var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }
const headingStyle: React.CSSProperties = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' }
const mutedStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }
const linkStyle: React.CSSProperties = { color: 'var(--color-accent)', fontSize: 'var(--text-sm)' }
const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }
const inputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-base)', width: '100%' }
const submitStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-base)', cursor: 'pointer', width: '100%' }
const fieldErrorStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }
