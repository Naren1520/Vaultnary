import React, { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import SkeletonLoader from './SkeletonLoader'

export interface TreeNode {
  id: string
  label: string
  description?: string
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
      className={`credential-tree${depth > 0 ? ' credential-tree--nested' : ''}`}
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
      className="credential-tree__item"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={isSelected}
    >
      <div className={`credential-tree__row${isSelected ? ' credential-tree__row--selected' : ''}`}>
        <button
          type="button"
          className="credential-tree__toggle"
          onClick={handleToggle}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.label}`}
          aria-expanded={hasChildren ? expanded : undefined}
          disabled={!hasChildren}
        >
          {expanded ? (
            <ChevronDown size={15} aria-hidden="true" />
          ) : (
            <ChevronRight size={15} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="credential-tree__select"
          onClick={handleSelect}
          aria-current={isSelected ? 'true' : undefined}
        >
          {node.icon && (
            <span className="credential-tree__icon">{node.icon}</span>
          )}
          <span className="credential-tree__copy">
            <strong>{node.label}</strong>
            {node.description && <span title={node.description}>{node.description}</span>}
          </span>
          <span className="credential-tree__open">View</span>
        </button>
      </div>

      {/* Children */}
      {expanded && (
        <div className="credential-tree__children">
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
