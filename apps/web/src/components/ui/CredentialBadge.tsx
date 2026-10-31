import React from 'react'
import {
  Mail,
  Globe,
  Database,
  Key,
  Ticket,
  Terminal,
  Bot,
  Clock,
  ShieldAlert,
  Settings2,
} from 'lucide-react'

export type CredentialType =
  | 'email'
  | 'website'
  | 'database'
  | 'api_key'
  | 'token'
  | 'ssh'
  | 'service_account'
  | 'totp'
  | 'recovery_code'
  | 'custom'

const TYPE_META: Record<CredentialType, { label: string; icon: React.ReactNode }> = {
  email:           { label: 'Email',           icon: <Mail size={14} aria-hidden="true" /> },
  website:         { label: 'Website',         icon: <Globe size={14} aria-hidden="true" /> },
  database:        { label: 'Database',        icon: <Database size={14} aria-hidden="true" /> },
  api_key:         { label: 'API Key',         icon: <Key size={14} aria-hidden="true" /> },
  token:           { label: 'Token',           icon: <Ticket size={14} aria-hidden="true" /> },
  ssh:             { label: 'SSH',             icon: <Terminal size={14} aria-hidden="true" /> },
  service_account: { label: 'Service Account', icon: <Bot size={14} aria-hidden="true" /> },
  totp:            { label: 'TOTP',            icon: <Clock size={14} aria-hidden="true" /> },
  recovery_code:   { label: 'Recovery Code',   icon: <ShieldAlert size={14} aria-hidden="true" /> },
  custom:          { label: 'Custom',          icon: <Settings2 size={14} aria-hidden="true" /> },
}

interface CredentialBadgeProps {
  type: CredentialType
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function CredentialBadge({
  type,
  showLabel = true,
  size = 'md',
}: CredentialBadgeProps) {
  const meta = TYPE_META[type] ?? TYPE_META.custom

  return (
    <span
      aria-label={meta.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: size === 'sm' ? '2px var(--space-1)' : 'var(--space-1) var(--space-2)',
        border: 'var(--border-card)',
        borderRadius: 'var(--radius-sm)',
        fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
        color: 'var(--color-text-muted)',
        backgroundColor: 'var(--color-bg-subtle)',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon}
      {showLabel && meta.label}
    </span>
  )
}
