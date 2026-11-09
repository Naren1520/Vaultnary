import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import AuthPageLayout from './AuthPageLayout'
import { useAuthStore } from '../../state/auth-store'
import { apiPost } from '../../services/http-client'
import { isValidEmail, isValidPassword } from '../../services/validation'
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler'
import type { LoginRequest, LoginResponse } from './types'
import './auth.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const setCsrfToken = useAuthStore((s) => s.setCsrfToken)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <AuthPageLayout>
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Sign in"
        aria-labelledby="auth-login-title"
        className="auth-login__form"
      >
        <div className="auth-login__form-heading">
          <span className="auth-login__form-kicker">SECURE WORKSPACE ACCESS</span>
          <h2 id="auth-login-title">Welcome back</h2>
          <p>Sign in to continue to your Vaultnary workspace.</p>
        </div>

        {globalError && <p role="alert" className="auth-login__alert">{globalError}</p>}
        {rateLimitMsg && <p role="alert" className="auth-login__alert auth-login__alert--muted">{rateLimitMsg}</p>}

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
          <div className="auth-login__label-row">
            <label htmlFor="password">Password</label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <div className="auth-login__password-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              aria-invalid={!!fieldErrors.password}
              disabled={loading}
            />
            <button
              className="auth-login__password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fieldErrors.password && <span id="password-error" role="alert" className="auth-login__field-error">{fieldErrors.password}</span>}
        </div>

        <button type="submit" disabled={loading} className="auth-login__submit">
          <span>{loading ? 'Signing in…' : 'Sign in securely'}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>

        <div className="auth-login__form-assurance">
          <ShieldCheck size={15} />
          <span>Your credentials are protected in transit.</span>
        </div>

        <p className="auth-login__register">
          New to Vaultnary? <Link to="/register">Create an account <ArrowRight size={14} /></Link>
        </p>
      </form>
    </AuthPageLayout>
  )
}
