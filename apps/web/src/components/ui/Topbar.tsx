import React, { Suspense, lazy, useState } from 'react'
import type { BreadcrumbItem } from './Breadcrumbs'
import Breadcrumbs from './Breadcrumbs'

/* Lazy-load GlobalSearch to keep the Topbar bundle lightweight */
const GlobalSearch = lazy(() => import('../../features/search/GlobalSearch'))

interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[]
  /** Replace the built-in search slot with a custom node */
  searchSlot?: React.ReactNode
  actionsSlot?: React.ReactNode
  /** Set to false to hide the built-in global search bar */
  showSearch?: boolean
}

export default function Topbar({
  breadcrumbs = [],
  searchSlot,
  actionsSlot,
  showSearch = true,
}: TopbarProps) {
  const [query, setQuery] = useState('')

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

      {/* Built-in global search (shown by default, can be overridden) */}
      {showSearch && !searchSlot && (
        <div style={{ flexShrink: 0 }}>
          <Suspense fallback={<SearchPlaceholder />}>
            <GlobalSearch query={query} onQueryChange={setQuery} />
          </Suspense>
        </div>
      )}

      {searchSlot && (
        <div style={{ flexShrink: 0 }}>
          {searchSlot}
        </div>
      )}

      {actionsSlot && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexShrink: 0,
          }}
        >
          {actionsSlot}
        </div>
      )}
    </header>
  )
}

/** Shown while GlobalSearch lazy-loads */
function SearchPlaceholder() {
  return (
    <input
      type="search"
      placeholder="Search vault…"
      disabled
      aria-label="Search vault"
      style={{
        width: '16rem',
        padding: 'var(--space-1) var(--space-3)',
        border: 'var(--border-input)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        backgroundColor: 'var(--color-bg-subtle)',
        color: 'var(--color-text)',
        boxSizing: 'border-box',
        opacity: 0.6,
      }}
    />
  )
}
