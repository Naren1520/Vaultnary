import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CredentialBadge, { CredentialType } from '../../components/ui/CredentialBadge'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import { apiGet } from '../../services/http-client'

interface SearchResult {
  id: string
  name: string
  credential_type: CredentialType
  tags: string[]
}

interface SearchResponse {
  data: SearchResult[]
}

interface GlobalSearchProps {
  /** Controlled query value from the parent */
  query: string
  onQueryChange: (q: string) => void
}

const DEBOUNCE_MS = 300

/**
 * Global search dropdown.
 * - 300ms debounce on query changes
 * - Shows SkeletonLoader while fetching
 * - Renders CredentialBadge + name for each result
 * - Clicking a result navigates to /app/vault/:itemId
 * - Hides when query is empty or results are empty after fetch
 */
export default function GlobalSearch({ query, onQueryChange }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  /* Debounced search */
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    setLoading(true)
    setOpen(true)

    const timer = setTimeout(() => {
      let cancelled = false
      const ctrl = new AbortController()

      apiGet<SearchResponse>(`/api/v1/vault/search?q=${encodeURIComponent(query.trim())}`, {
        signal: ctrl.signal,
      })
        .then((res) => {
          if (cancelled) return
          setResults(res.data)
          setOpen(res.data.length > 0)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

      return () => {
        cancelled = true
        ctrl.abort()
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  /* Close dropdown when clicking outside */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleResultClick(id: string) {
    setOpen(false)
    onQueryChange('')
    navigate(`/app/vault/${id}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      onQueryChange('')
    }
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '16rem' }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="Search vault…"
        aria-label="Search vault"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        style={{
          width: '100%',
          padding: 'var(--space-1) var(--space-3)',
          border: 'var(--border-input)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          backgroundColor: 'var(--color-bg-subtle)',
          color: 'var(--color-text)',
          boxSizing: 'border-box',
        }}
      />

      {showDropdown && (
        <div
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1))',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-bg)',
            border: 'var(--border-card)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
            maxHeight: '20rem',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: 'var(--space-3)' }}>
              <SkeletonLoader variant="search-result" rows={3} />
            </div>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                role="option"
                aria-selected={false}
                onClick={() => handleResultClick(result.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  borderBottom: 'var(--border-card)',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--color-bg-subtle)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                }}
              >
                <CredentialBadge type={result.credential_type} showLabel={false} size="sm" />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {result.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
