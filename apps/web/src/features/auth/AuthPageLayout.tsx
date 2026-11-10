import type { ReactNode } from 'react'
import { Fingerprint, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import logoUrl from '../../assets/logo.png'
import SiteMetadata from '../seo/SiteMetadata'
import AuthPattern from './AuthPattern'

interface AuthPageLayoutProps {
  children: ReactNode
  title: string
  description: string
}

export default function AuthPageLayout({ children, title, description }: AuthPageLayoutProps) {
  return (
    <main className="auth-page auth-page--login">
      <SiteMetadata title={title} description={description} noIndex />
      <AuthPattern />

      <div className="auth-login">
        <section className="auth-login__story" aria-labelledby="auth-login-story-title">
          <Link to="/" className="auth-login__brand" aria-label="Vaultnary home">
            <img src={logoUrl} alt="" />
            <span>Vaultnary</span>
          </Link>

          <div className="auth-login__story-content">
            <h1 id="auth-login-story-title">
              Your team’s keys.<br />
              <span>In the right hands.</span>
            </h1>
            <p className="auth-login__story-description">
              Keep credentials organized, share access with intention, and stay in control of your vault.
            </p>

            <div className="auth-login__security-card">
              <div className="auth-login__security-card-top">
                <span className="auth-login__security-label">
                  <span className="auth-login__security-icon"><Fingerprint size={18} /></span>
                  VAULT PROTECTION
                </span>
                <span className="auth-login__live"><i /> ACTIVE</span>
              </div>
              <div className="auth-login__scanner" aria-hidden="true">
                <Fingerprint size={68} strokeWidth={1.25} />
                <span className="auth-login__scanner-line" />
              </div>
              <div className="auth-login__security-card-copy">
                <strong>Your vault stays yours.</strong>
                <span>Vault data is encrypted in your browser, keeping sensitive values private.</span>
              </div>
              <div className="auth-login__scanner-track" aria-hidden="true">
                <span />
              </div>
              <div className="auth-login__security-card-footer">
                <span><KeyRound size={13} /> Browser-side encryption</span>
                <span>AES-256</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-login__form-side" aria-label="Account access">
          <div className="auth-login__mobile-brand">
            <Link to="/" className="auth-login__brand" aria-label="Vaultnary home">
              <img src={logoUrl} alt="" />
              <span>Vaultnary</span>
            </Link>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}
