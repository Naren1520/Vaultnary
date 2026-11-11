import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TreeView, { TreeNode } from '../../components/ui/TreeView'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'
import { useVaultStore } from '../../state/vault-store'
import { decryptVaultMetadata, type EncryptedVaultItem } from '../vault/metadata'

interface TreeItemResponse extends EncryptedVaultItem {
  has_children: boolean
  children?: TreeItemResponse[]
}

interface TreeResponse {
  data: TreeItemResponse[]
}

async function mapToTreeNode(item: TreeItemResponse, privateKey: CryptoKey): Promise<TreeNode> {
  const metadata = await decryptVaultMetadata(item, privateKey)
  return {
    id: item.id,
    label: metadata.legacy ? 'Legacy credential' : metadata.name,
    hasChildren: item.has_children,
    children: item.children
      ? await Promise.all(item.children.map((child) => mapToTreeNode(child, privateKey)))
      : undefined,
  }
}

export default function VaultTree() {
  const navigate = useNavigate()
  const privateKey = useVaultStore((state) => state.privateKey)
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<TreeResponse>('/api/v1/vault/tree?depth=2', { signal: ctrl.signal })
      .then(async (res) => {
        if (!privateKey) throw new Error('Unlock the vault to view its hierarchy.')
        const nodes = await Promise.all(
          res.data.map((item) => mapToTreeNode(item, privateKey)),
        )
        if (!ctrl.signal.aborted) setNodes(nodes)
      })
      .catch((cause: unknown) => {
        if (!ctrl.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load the vault hierarchy.')
        }
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [privateKey])

  async function handleExpand(node: TreeNode): Promise<TreeNode[]> {
    if (!privateKey) throw new Error('Unlock the vault to view its hierarchy.')
    const res = await apiGet<{ data: TreeItemResponse[] }>(
      `/api/v1/vault/items/${node.id}/children`,
    )
    return Promise.all(res.data.map((item) => mapToTreeNode(item, privateKey)))
  }

  if (error) {
    return <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>
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
    return (
      <EmptyState
        title="Your hierarchy is ready"
        message="Once you add credentials, their folders and relationships will appear here."
        action={
          <Link
            to="/app/vault"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.65rem 0.9rem',
              borderRadius: '0.7rem',
              background: '#1f2937',
              color: '#fff',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            Go to your vault
          </Link>
        }
      />
    )
  }

  return (
    <TreeView
      nodes={nodes}
      onNodeSelect={(node) => navigate(`/app/vault/${node.id}`)}
      onNodeExpand={handleExpand}
    />
  )
}
