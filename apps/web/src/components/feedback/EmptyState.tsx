import React from 'react'
import { FolderOpen } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  message?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export default function EmptyState({
  title = 'Nothing here yet',
  message,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className="app-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-8)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
      }}
    >
      <span aria-hidden="true" className="app-empty-state__icon">
        {icon ?? <FolderOpen size={32} />}
      </span>
      <p className="app-empty-state__title" style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
        {title}
      </p>
      {message && (
        <p className="app-empty-state__message" style={{ fontSize: 'var(--text-sm)' }}>{message}</p>
      )}
      {action && <div className="app-empty-state__action">{action}</div>}
    </div>
  )
}
