import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FolderKey, GitBranch, FolderOpen, Server, ShieldCheck, ScrollText, Users, CircleUserRound } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Vault',      href: '/app/vault',      icon: <FolderKey   size={16} aria-hidden="true" /> },
  { label: 'Hierarchy',  href: '/app/hierarchy',   icon: <GitBranch   size={16} aria-hidden="true" /> },
  { label: 'Projects',   href: '/app/projects',    icon: <FolderOpen  size={16} aria-hidden="true" /> },
  { label: 'Services',   href: '/app/services',    icon: <Server      size={16} aria-hidden="true" /> },
  { label: 'Workspaces', href: '/app/workspaces',  icon: <Users       size={16} aria-hidden="true" /> },
  { label: 'Security',   href: '/app/security',    icon: <ShieldCheck size={16} aria-hidden="true" /> },
  { label: 'Audit Log',  href: '/app/audit',       icon: <ScrollText  size={16} aria-hidden="true" /> },
  { label: 'Profile',    href: '/app/profile',     icon: <CircleUserRound size={16} aria-hidden="true" /> },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside
      aria-label="Main navigation"
      className="app-sidebar"
    >
      {/* Brand / Logo */}
      <div
        className="sidebar-brand"
      >
        <Link to="/app/vault" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <LogoOrText />
        </Link>
      </div>

      {/* Nav links */}
      <nav aria-label="Sidebar navigation">
        <ul className="sidebar-links">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className="sidebar-link"
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                    color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                    backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

/** Shows logo.png if the file exists, otherwise falls back to the text "Vaultnary" */
function LogoOrText() {
  const [imgFailed, setImgFailed] = React.useState(false)

  // logo.png should be placed at src/assets/logo.png
  const logoUrl = new URL('../../assets/logo.png', import.meta.url).href

  if (!imgFailed) {
    return (
      <img
        src={logoUrl}
        alt="Vaultnary"
        onError={() => setImgFailed(true)}
        style={{ height: '2rem', width: 'auto', objectFit: 'contain' }}
      />
    )
  }

  return (
    <span
      style={{
        fontWeight: 'var(--font-weight-semibold)',
        fontSize: 'var(--text-base)',
        color: 'var(--color-text)',
        letterSpacing: '-0.02em',
      }}
    >
      Vaultnary
    </span>
  )
}
