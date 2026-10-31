import React from 'react'
import SkeletonLoader from './SkeletonLoader'

interface InspectorProps {
  loading?: boolean
  children?: React.ReactNode
  title?: string
}

export default function Inspector({ loading = false, children, title }: InspectorProps) {
  return (
    <aside
      aria-label={title ?? 'Detail panel'}
      style={{
        width: 'var(--inspector-width)',
        minHeight: '100%',
        borderLeft: 'var(--border-card)',
        backgroundColor: 'var(--color-bg)',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      {loading ? (
        <SkeletonLoader variant="detail-panel" />
      ) : (
        children
      )}
    </aside>
  )
}
