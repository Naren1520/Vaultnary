import React from 'react'
import type { BreadcrumbItem } from './Breadcrumbs'
import Breadcrumbs from './Breadcrumbs'

interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[]
  searchSlot?: React.ReactNode
  actionsSlot?: React.ReactNode
}

export default function Topbar({ breadcrumbs = [], searchSlot, actionsSlot }: TopbarProps) {
  return (
    <header
      style={{
        height: '3rem',
        borderBottom: 'var(--border-card)',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        gap: 'var(--space-4)',
        flexShrink: 0,
      }}
    >
      {breadcrumbs.length > 0 && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      {searchSlot && (
        <div style={{ flexShrink: 0 }}>
          {searchSlot}
        </div>
      )}

      {actionsSlot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {actionsSlot}
        </div>
      )}
    </header>
  )
}
