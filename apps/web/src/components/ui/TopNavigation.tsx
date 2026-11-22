import { useState } from 'react'
import { Building2, CircleUserRound, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const navigationItems = [
  { label: 'Workspace', href: '/app/workspaces', icon: Building2 },
  { label: 'Security', href: '/app/security', icon: ShieldCheck },
  { label: 'Profile', href: '/app/profile', icon: CircleUserRound },
]

const workspacePaths = [
  '/app/workspaces',
  '/app/projects',
  '/app/services',
  '/app/vault',
  '/app/vaults',
  '/app/hierarchy',
]

export default function TopNavigation() {
  const { pathname } = useLocation()
  const isWorkspaceArea = workspacePaths.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  )

  return (
    <header className="app-primary-nav">
      <Link to="/app/workspaces" className="app-primary-nav__brand" aria-label="Vaultnary workspace">
        <LogoOrText />
      </Link>
      <nav aria-label="Primary navigation" className="app-primary-nav__pills">
        {navigationItems.map(({ label, href, icon: Icon }) => {
          const isActive = href === '/app/workspaces'
            ? isWorkspaceArea
            : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              to={href}
              className="app-primary-nav__pill"
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

function LogoOrText() {
  const [imgFailed, setImgFailed] = useState(false)
  const logoUrl = new URL('../../assets/logo.png', import.meta.url).href

  if (!imgFailed) {
    return (
      <img
        src={logoUrl}
        alt="Vaultnary"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return <span>Vaultnary</span>
}
