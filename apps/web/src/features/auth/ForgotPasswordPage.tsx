import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Mail } from 'lucide-react'
import { apiPost } from '../../services/http-client'
import { isValidEmail } from '../../services/validation'
import type { ForgotPasswordRequest } from './types'
import AuthPageLayout from './AuthPageLayout'
import './auth.css'

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
    <AuthPageLayout
      title="Reset your password"
      description="Request a secure password reset link for your Vaultnary account."
    >
      {submitted ? (
        <div className="auth-login__form" aria-labelledby="reset-sent-title">
          <div className="auth-login__status-icon"><Check size={23} /></div>
          <div className="auth-login__form-heading">
            <span className="auth-login__form-kicker">CHECK YOUR INBOX</span>
            <h2 id="reset-sent-title">If there’s an account, you’ll hear from us</h2>
            <p>If an account exists for that address, a reset link has been sent.</p>
          </div>
          <Link to="/login" className="auth-login__text-link">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate aria-label="Reset password" className="auth-login__form">
          <div className="auth-login__form-heading">
            <span className="auth-login__form-kicker">ACCOUNT RECOVERY</span>
            <h2>Reset password</h2>
            <p>Enter your account email and we’ll send a secure reset link if it’s registered.</p>
          </div>

          <div className="auth-login__field">
            <label htmlFor="email">Email address</label>
            <div className="auth-login__input-with-icon">
              <Mail size={16} aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={emailError ? 'email-error' : undefined}
                aria-invalid={!!emailError}
                disabled={loading}
              />
            </div>
            {emailError && <span id="email-error" role="alert" className="auth-login__field-error">{emailError}</span>}
          </div>

          <button type="submit" disabled={loading} className="auth-login__submit">
            <span>{loading ? 'Sending…' : 'Send reset link'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <Link to="/login" className="auth-login__text-link">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </form>
      )}
    </AuthPageLayout>
  )
}
