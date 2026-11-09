import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, LoaderCircle, ShieldAlert } from 'lucide-react'
import { apiGet } from '../../services/http-client'
import AuthPageLayout from './AuthPageLayout'
import './auth.css'

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
    <AuthPageLayout>
      <div className="auth-login__form" aria-live="polite">
        {state === 'loading' && (
          <>
            <div className="auth-login__status-icon auth-login__status-icon--loading"><LoaderCircle size={23} /></div>
            <div className="auth-login__form-heading">
              <span className="auth-login__form-kicker">SECURE ACCOUNT SETUP</span>
              <h2>Verifying your email</h2>
              <p role="status">We’re confirming your address and activating your account.</p>
            </div>
          </>
        )}
        {state === 'success' && (
          <>
            <div className="auth-login__status-icon"><Check size={23} /></div>
            <div className="auth-login__form-heading">
              <span className="auth-login__form-kicker">VERIFICATION COMPLETE</span>
              <h2>Email verified</h2>
              <p>Your account is active. Sign in to continue to your secure workspace.</p>
            </div>
            <Link to="/login" className="auth-login__submit auth-login__submit--link">
              <span>Sign in securely</span><ArrowRight size={17} />
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="auth-login__status-icon auth-login__status-icon--error"><ShieldAlert size={23} /></div>
            <div className="auth-login__form-heading">
              <span className="auth-login__form-kicker">VERIFICATION NEEDED</span>
              <h2>Couldn’t verify this link</h2>
              <p>The link may be expired or already used. Sign in or request a new verification email.</p>
            </div>
            <Link to="/login" className="auth-login__submit auth-login__submit--link">
              <span>Back to sign in</span><ArrowRight size={17} />
            </Link>
          </>
        )}
      </div>
    </AuthPageLayout>
  )
}
