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
      <span aria-hidden="true" style={{ color: 'var(--color-border)' }}>
        {icon ?? <FolderOpen size={32} />}
      </span>
      <p style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
        {title}
      </p>
      {message && (
        <p style={{ fontSize: 'var(--text-sm)', maxWidth: '20rem' }}>{message}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
