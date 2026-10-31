import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TreeView, { TreeNode } from '../../components/ui/TreeView'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface TreeItemResponse {
  id: string
  name: string
  credential_type: string
  has_children: boolean
  children?: TreeItemResponse[]
}

interface TreeResponse {
  data: TreeItemResponse[]
}

function mapToTreeNode(item: TreeItemResponse): TreeNode {
  return {
    id: item.id,
    label: item.name,
    hasChildren: item.has_children,
    children: item.children?.map(mapToTreeNode),
  }
}

export default function VaultTree() {
  const navigate = useNavigate()
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<TreeResponse>('/api/v1/vault/tree?depth=2', { signal: ctrl.signal })
      .then((res) => setNodes(res.data.map(mapToTreeNode)))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  async function handleExpand(node: TreeNode): Promise<TreeNode[]> {
    const res = await apiGet<{ data: TreeItemResponse[] }>(
      `/api/v1/vault/items/${node.id}/children`,
    )
    return res.data.map(mapToTreeNode)
  }

  if (loading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLoader key={i} variant="tree-node" />
        ))}
      </div>
    )
  }

  if (nodes.length === 0) {
    return <EmptyState title="No credentials yet" message="Create credentials to see the hierarchy." />
  }

  return (
    <TreeView
      nodes={nodes}
      onNodeSelect={(node) => navigate(`/app/vault/${node.id}`)}
      onNodeExpand={handleExpand}
    />
  )
}
