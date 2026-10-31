import React from 'react'

export type SkeletonVariant =
  | 'line'
  | 'multiline'
  | 'table-row'
  | 'tree-node'
  | 'detail-panel'
  | 'search-result'
  | 'badge-title'

interface SkeletonLoaderProps {
  variant: SkeletonVariant
  /** Number of rows for 'multiline' and 'table-row' variants */
  rows?: number
  className?: string
}

const pulseStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-subtle)',
  borderRadius: 'var(--radius-sm)',
  animation: 'skeleton-pulse 1.4s ease-in-out infinite',
}

/**
 * CSS-only skeleton loader. All animation uses @keyframes — no JS animation.
 * The global keyframe is injected once via a <style> tag in the DOM.
 */
export default function SkeletonLoader({
  variant,
  rows = 3,
  className,
}: SkeletonLoaderProps) {
  return (
    <>
      <SkeletonKeyframes />
      <SkeletonShape variant={variant} rows={rows} className={className} />
    </>
  )
}

function SkeletonKeyframes() {
  return (
    <style>{`
      @keyframes skeleton-pulse {
        0%   { opacity: 1; }
        50%  { opacity: 0.4; }
        100% { opacity: 1; }
      }
    `}</style>
  )
}

function SkeletonShape({
  variant,
  rows,
  className,
}: {
  variant: SkeletonVariant
  rows: number
  className?: string
}) {
  const base: React.CSSProperties = { ...pulseStyle }

  switch (variant) {
    case 'line':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ ...base, height: '1rem', width: '60%' }}
        />
      )

    case 'multiline':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{ ...base, height: '1rem', width: i === rows - 1 ? '40%' : '100%' }}
            />
          ))}
        </div>
      )

    case 'table-row':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--space-3) 0',
                borderBottom: 'var(--border-card)',
              }}
            >
              <div style={{ ...base, height: '1rem', width: '30%' }} />
              <div style={{ ...base, height: '1rem', width: '20%' }} />
              <div style={{ ...base, height: '1rem', flex: 1 }} />
            </div>
          ))}
        </div>
      )

    case 'tree-node':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}
        >
          <div style={{ ...base, width: '1rem', height: '1rem', flexShrink: 0 }} />
          <div style={{ ...base, height: '0.875rem', width: '50%' }} />
        </div>
      )

    case 'detail-panel':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)' }}
        >
          <div style={{ ...base, height: '1.5rem', width: '50%' }} />
          <div style={{ ...base, height: '1rem', width: '80%' }} />
          <div style={{ ...base, height: '2.5rem', width: '100%' }} />
          <div style={{ ...base, height: '1rem', width: '60%' }} />
          <div style={{ ...base, height: '2.5rem', width: '100%' }} />
          <div style={{ ...base, height: '1rem', width: '70%' }} />
        </div>
      )

    case 'search-result':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                border: 'var(--border-card)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ ...base, width: '1.5rem', height: '1.5rem', flexShrink: 0, borderRadius: 'var(--radius-sm)' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <div style={{ ...base, height: '0.875rem', width: '40%' }} />
                <div style={{ ...base, height: '0.75rem', width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      )

    case 'badge-title':
      return (
        <div
          role="status"
          aria-label="Loading"
          className={className}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <div style={{ ...base, width: '1.5rem', height: '1.5rem', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
          <div style={{ ...base, height: '1rem', width: '40%' }} />
        </div>
      )

    default:
      return null
  }
}
