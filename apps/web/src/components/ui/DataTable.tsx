import React, { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

type SortDirection = 'asc' | 'desc'

interface SortState {
  key: string
  direction: SortDirection
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  selectedKey?: string
  caption?: string
}

/**
 * Typed, sortable data table with row selection.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyState,
  selectedKey,
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  function handleSortClick(col: Column<T>) {
    if (!col.sortable) return
    setSort((prev) => {
      if (prev?.key === col.key) {
        return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key: col.key, direction: 'asc' }
    })
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text)',
        }}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr style={{ borderBottom: 'var(--border-card)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                onClick={() => handleSortClick(col)}
                aria-sort={
                  sort?.key === col.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : col.sortable
                    ? 'none'
                    : undefined
                }
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  textAlign: 'left',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-muted)',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  {col.header}
                  {col.sortable && (
                    <span aria-hidden="true" style={{ display: 'inline-flex', flexDirection: 'column' }}>
                      <ChevronUp
                        size={10}
                        style={{
                          color: sort?.key === col.key && sort.direction === 'asc'
                            ? 'var(--color-accent)'
                            : 'var(--color-border)',
                        }}
                      />
                      <ChevronDown
                        size={10}
                        style={{
                          color: sort?.key === col.key && sort.direction === 'desc'
                            ? 'var(--color-accent)'
                            : 'var(--color-border)',
                        }}
                      />
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}
              >
                {emptyState ?? 'No data'}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = getRowKey(row)
              const isSelected = selectedKey === key
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  }}
                  aria-selected={onRowClick ? isSelected : undefined}
                  style={{
                    borderBottom: 'var(--border-card)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    backgroundColor: isSelected ? 'rgba(37,99,235,0.06)' : 'transparent',
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: 'var(--space-3)',
                        verticalAlign: 'middle',
                      }}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
