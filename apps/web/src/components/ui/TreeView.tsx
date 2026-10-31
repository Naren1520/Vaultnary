import React, { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import SkeletonLoader from './SkeletonLoader'

export interface TreeNode {
  id: string
  label: string
  /** If true, the node has children but they haven't been loaded yet */
  hasChildren?: boolean
  children?: TreeNode[]
  /** Arbitrary icon to display next to the label */
  icon?: React.ReactNode
}

interface TreeViewProps {
  nodes: TreeNode[]
  onNodeSelect?: (node: TreeNode) => void
  onNodeExpand?: (node: TreeNode) => Promise<TreeNode[]>
  selectedId?: string
  depth?: number
}

/**
 * Recursive tree view with expand/collapse and lazy loading.
 * Shows <SkeletonLoader variant="tree-node"> while children are loading.
 */
export default function TreeView({
  nodes,
  onNodeSelect,
  onNodeExpand,
  selectedId,
  depth = 0,
}: TreeViewProps) {
  return (
    <ul
      role={depth === 0 ? 'tree' : 'group'}
      style={{ listStyle: 'none', paddingLeft: depth === 0 ? 0 : 'var(--space-4)' }}
    >
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          onNodeSelect={onNodeSelect}
          onNodeExpand={onNodeExpand}
          selectedId={selectedId}
          depth={depth}
        />
      ))}
    </ul>
  )
}

function TreeItem({
  node,
  onNodeSelect,
  onNodeExpand,
  selectedId,
  depth,
}: {
  node: TreeNode
  onNodeSelect?: (node: TreeNode) => void
  onNodeExpand?: (node: TreeNode) => Promise<TreeNode[]>
  selectedId?: string
  depth: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [children, setChildren] = useState<TreeNode[] | undefined>(node.children)

  const hasChildren = node.hasChildren || (children && children.length > 0)
  const isSelected = selectedId === node.id

  async function handleToggle(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if (!hasChildren) return

    if (!expanded && onNodeExpand && !children) {
      setLoading(true)
      try {
        const loaded = await onNodeExpand(node)
        setChildren(loaded)
      } finally {
        setLoading(false)
      }
    }
    setExpanded((prev) => !prev)
  }

  function handleSelect() {
    onNodeSelect?.(node)
  }

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={isSelected}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          backgroundColor: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
          color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
          fontSize: 'var(--text-sm)',
        }}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSelect()
          }
          if (e.key === 'ArrowRight') handleToggle(e)
          if (e.key === 'ArrowLeft' && expanded) handleToggle(e)
        }}
        tabIndex={0}
      >
        {/* Expand/collapse toggle */}
        <span
          onClick={handleToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--color-text-muted)',
            visibility: hasChildren ? 'visible' : 'hidden',
            flexShrink: 0,
          }}
        >
          {expanded ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
        </span>

        {node.icon && (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {node.icon}
          </span>
        )}

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </span>
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {loading ? (
            <div style={{ paddingLeft: 'var(--space-4)' }}>
              <SkeletonLoader variant="tree-node" />
              <SkeletonLoader variant="tree-node" />
            </div>
          ) : children && children.length > 0 ? (
            <TreeView
              nodes={children}
              onNodeSelect={onNodeSelect}
              onNodeExpand={onNodeExpand}
              selectedId={selectedId}
              depth={depth + 1}
            />
          ) : null}
        </div>
      )}
    </li>
  )
}
