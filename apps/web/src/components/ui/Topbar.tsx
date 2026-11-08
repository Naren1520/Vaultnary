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
      className="app-topbar"
      style={{
        borderBottom: 'var(--border-card)',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {breadcrumbs.length > 0 && (
        <div className="topbar-breadcrumbs">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      {/* Built-in global search (shown by default, can be overridden) */}
      {showSearch && !searchSlot && (
        <div className="topbar-search">
          <Suspense fallback={<SearchPlaceholder />}>
            <GlobalSearch query={query} onQueryChange={setQuery} />
          </Suspense>
        </div>
      )}

      {searchSlot && (
        <div className="topbar-search">
          {searchSlot}
        </div>
      )}

      {actionsSlot && (
        <div className="topbar-actions">
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
        width: 'min(16rem, 100%)',
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
