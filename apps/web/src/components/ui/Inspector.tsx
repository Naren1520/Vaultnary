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
      className="app-inspector"
    >
      {loading ? (
        <SkeletonLoader variant="detail-panel" />
      ) : (
        children
      )}
    </aside>
  )
}
