import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  FolderKey,
  GitBranch,
  FolderOpen,
  Server,
  ScrollText,
  Lock,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Vault', href: '/app/vault', icon: <FolderKey size={16} aria-hidden="true" /> },
  { label: 'Hierarchy', href: '/app/hierarchy', icon: <GitBranch size={16} aria-hidden="true" /> },
  { label: 'Projects', href: '/app/projects', icon: <FolderOpen size={16} aria-hidden="true" /> },
  { label: 'Services', href: '/app/services', icon: <Server size={16} aria-hidden="true" /> },
  { label: 'Security', href: '/app/security', icon: <ShieldCheck size={16} aria-hidden="true" /> },
  { label: 'Audit Log', href: '/app/audit', icon: <ScrollText size={16} aria-hidden="true" /> },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside
      aria-label="Main navigation"
      style={{
        width: 'var(--sidebar-width)',
        minHeight: '100vh',
        borderRight: 'var(--border-card)',
        backgroundColor: 'var(--color-bg-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-4) 0',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '0 var(--space-4)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <Lock size={18} aria-hidden="true" style={{ color: 'var(--color-accent)' }} />
        <span
          style={{
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text)',
          }}
        >
          Vaultnary
        </span>
      </div>

      {/* Nav */}
      <nav aria-label="Sidebar navigation">
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                    color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                    backgroundColor: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                    margin: '0 var(--space-2)',
                    textDecoration: 'none',
                    transition: 'background-color 0.1s',
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
