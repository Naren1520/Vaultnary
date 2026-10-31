import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { apiGet } from '../../services/http-client'

type State = 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setState('error'); return }

    apiGet(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setState('success'))
      .catch(() => setState('error'))
  }, [searchParams])

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {state === 'loading' && (
          <p style={mutedStyle} role="status">Verifying your email…</p>
        )}
        {state === 'success' && (
          <>
            <h1 style={headingStyle}>Email verified</h1>
            <p style={mutedStyle}>Your account is now active.</p>
            <Link to="/login" style={linkStyle}>Sign in</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 style={headingStyle}>Verification failed</h1>
            <p style={mutedStyle}>The link may be expired or already used. Request a new one below.</p>
            <Link to="/login" style={linkStyle}>Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)' }
const cardStyle: React.CSSProperties = { width: '100%', maxWidth: '24rem', backgroundColor: 'var(--color-bg)', border: 'var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }
const headingStyle: React.CSSProperties = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)' }
const mutedStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }
const linkStyle: React.CSSProperties = { color: 'var(--color-accent)', fontSize: 'var(--text-sm)' }
