import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import logoUrl from '../../assets/logo.png'
import './legal.css'

const privacyEmail = 'narensonu1520@gmail.com'

export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash])

  return (
    <div className="public-site">
      <a className="public-site__skip-link" href="#public-main">Skip to content</a>
      <header className="public-header">
        <div className="public-container public-header__inner">
          <Link to="/" className="public-brand" aria-label="Vaultnary home">
            <img src={logoUrl} alt="Vaultnary" />
          </Link>
          <div className="public-header__actions">
            <Link to="/login" className="public-header__login">Log in</Link>
            <Link to="/register" className="public-button public-button--small">
              Get started <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="public-main">{children}</main>

      <footer className="public-footer">
        <div className="public-container">
          <div className="public-footer__top">
            <div className="public-footer__brand">
              <Link to="/" className="public-brand" aria-label="Vaultnary home">
                <img src={logoUrl} alt="Vaultnary" />
              </Link>
              <p>A considered home for the credentials and access your team relies on.</p>
            </div>
            <nav className="public-footer__column" aria-label="Explore">
              <h2>Explore</h2>
              <Link to="/#product">Product</Link>
              <Link to="/#workspaces">Workspaces</Link>
              <Link to="/security">Security</Link>
            </nav>
            <nav className="public-footer__column" aria-label="Legal and account">
              <h2>Information</h2>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <a href={`mailto:${privacyEmail}`}>Contact</a>
            </nav>
          </div>
          <div className="public-footer__bottom">
            <span>© {new Date().getFullYear()} Vaultnary</span>
            <span>Thoughtful access management for teams.</span>
            <Link to="/register">Create your workspace <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
