import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, CircleUserRound, LogOut, Mail, ShieldCheck } from 'lucide-react'
import Topbar from '../../components/ui/Topbar'
import { useAuthStore } from '../../state/auth-store'
import { useVaultStore } from '../../state/vault-store'
import { apiGet, apiPost } from '../../services/http-client'
import { getErrorMessage } from '../../services/error-handler'
import ChangePasswordForm from './components/ChangePasswordForm'
import AccountDeletionSection from './components/AccountDeletionSection'
import type { UserProfile } from './types'
import './profile.css'

export default function ProfilePage() {
  const navigate = useNavigate()
  const clearCsrfToken = useAuthStore((state) => state.clearCsrfToken)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const emailName = profile?.email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Vaultnary User'
  const emailInitial = profile?.email.trim()
    ? profile.email.trim().charAt(0).toUpperCase()
    : 'V'

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')

    apiGet<{ data: UserProfile }>('/api/v1/users/me', { signal: controller.signal })
      .then((response) => setProfile(response.data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(getErrorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [retryCount])

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await apiPost<void>('/api/v1/auth/logout')
      clearCsrfToken()
      useVaultStore.getState().lockVault()
      navigate('/login', { replace: true })
    } catch (cause) {
      setLogoutError(getErrorMessage(cause))
      setLoggingOut(false)
    }
  }

  return (
    <div className="profile-page">
      <Topbar breadcrumbs={[{ label: 'Profile', href: '/app/profile' }]} showSearch={false} />
      <div className="profile-content">
        <header className="profile-page-heading">
          <span className="profile-page-heading__icon"><CircleUserRound size={22} aria-hidden="true" /></span>
          <div>
            <p className="profile-eyebrow">Account settings</p>
            <h1>Your profile</h1>
            <p>Manage your sign-in details and account access.</p>
          </div>
        </header>

        <div className="profile-layout">
          <aside className="profile-summary-card" aria-label="Account summary">
            <div className="profile-avatar" aria-hidden="true">{emailInitial}</div>
            {loading ? (
              <p className="profile-muted" role="status">Loading account…</p>
            ) : profile ? (
              <>
                <h2>{emailName}</h2>
                <p className="profile-summary-email">{profile.email}</p>
                <span className={profile.email_verified ? 'profile-summary-status profile-summary-status--verified' : 'profile-summary-status'}>
                  {profile.email_verified ? <><BadgeCheck size={14} aria-hidden="true" /> Email verified</> : 'Email not verified'}
                </span>
              </>
            ) : null}
            <nav className="profile-section-nav" aria-label="Profile sections">
              <a href="#profile-details-title">Profile details</a>
              <a href="#profile-password-title">Password and security</a>
              <a href="#profile-delete-title">Delete account</a>
            </nav>
          </aside>

          <div className="profile-primary-column">
            <section className="profile-card" aria-labelledby="profile-details-title">
              <div className="profile-card-heading">
                <div className="profile-card-heading__icon"><CircleUserRound size={18} aria-hidden="true" /></div>
                <div>
                  <h2 id="profile-details-title">Profile details</h2>
                  <p>Your Vaultnary account information.</p>
                </div>
              </div>
              {loading ? (
                <p className="profile-muted" role="status">Loading your profile…</p>
              ) : loadError ? (
                <div>
                  <p className="profile-alert" role="alert">{loadError}</p>
                  <button className="profile-secondary-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>
                    Try again
                  </button>
                </div>
              ) : profile ? (
                <dl className="profile-details-list">
                  <div>
                    <dt><Mail size={15} aria-hidden="true" /> Email address</dt>
                    <dd>{profile.email}</dd>
                  </div>
                  <div>
                    <dt><ShieldCheck size={15} aria-hidden="true" /> Email status</dt>
                    <dd className={profile.email_verified ? 'profile-verified' : 'profile-unverified'}>
                      {profile.email_verified ? <><BadgeCheck size={15} aria-hidden="true" /> Verified</> : 'Not verified'}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section className="profile-card" aria-labelledby="profile-password-title">
              <div className="profile-card-heading">
                <div className="profile-card-heading__icon"><ShieldCheck size={18} aria-hidden="true" /></div>
                <div>
                  <h2 id="profile-password-title">Password and security</h2>
                  <p>Choose a strong, unique password to protect your account.</p>
                </div>
              </div>
              <ChangePasswordForm />
            </section>
          </div>

          <aside className="profile-secondary-column">
            <section className="profile-card profile-logout-card" aria-labelledby="profile-logout-title">
              <div className="profile-card-heading">
                <div className="profile-card-heading__icon"><LogOut size={18} aria-hidden="true" /></div>
                <div>
                  <h2 id="profile-logout-title">Sign out</h2>
                  <p>End this session on this device.</p>
                </div>
              </div>
              {logoutError && <p className="profile-alert" role="alert">{logoutError}</p>}
              <button
                className="profile-logout-button"
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                <LogOut size={16} aria-hidden="true" />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </section>

            <section className="profile-card profile-security-card" aria-labelledby="profile-security-title">
              <div className="profile-card-heading">
                <div className="profile-card-heading__icon"><ShieldCheck size={18} aria-hidden="true" /></div>
                <div>
                  <h2 id="profile-security-title">Account protection</h2>
                  <p>Security status and session controls.</p>
                </div>
              </div>
              <Link className="profile-security-link" to="/app/security" aria-label="Open Security Center">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  <strong>Open Security Center</strong>
                  <small>Review sessions and activity</small>
                </span>
              </Link>
            </section>
          </aside>
        </div>

        <div className="profile-wide-section">
          <AccountDeletionSection />
        </div>
      </div>
    </div>
  )
}
