import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
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
    description: metadata.legacy
      ? 'Legacy credential'
      : metadata.notes || metadata.credential_type.replace(/_/g, ' '),
    icon: <KeyRound size={16} aria-hidden="true" />,
    hasChildren: item.has_children,
    children: item.children
      ? await Promise.all(item.children.map((child) => mapToTreeNode(child, privateKey)))
      : undefined,
  }
}

export default function VaultTree({ vaultId }: { vaultId: string }) {
  const navigate = useNavigate()
  const privateKey = useVaultStore((state) => state.privateKey)
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    apiGet<TreeResponse>(
      `/api/v1/vault/tree?vault_id=${encodeURIComponent(vaultId)}&depth=2`,
      { signal: ctrl.signal },
    )
      .then(async (res) => {
        if (!privateKey) throw new Error('Unlock the vault to view its hierarchy.')
        const nodes = await Promise.all(
          res.data.map((item) => mapToTreeNode(item, privateKey)),
        )
        if (!ctrl.signal.aborted) {
          setNodes(nodes)
          setError('')
        }
      })
      .catch((cause: unknown) => {
        if (!ctrl.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load the vault hierarchy.')
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [privateKey, retryCount, vaultId])

  async function handleExpand(node: TreeNode): Promise<TreeNode[]> {
    if (!privateKey) throw new Error('Unlock the vault to view its hierarchy.')
    const res = await apiGet<{ data: TreeItemResponse[] }>(
      `/api/v1/vault/items/${node.id}/children?vault_id=${encodeURIComponent(vaultId)}`,
    )
    return Promise.all(res.data.map((item) => mapToTreeNode(item, privateKey)))
  }

  if (error) {
    return (
      <div role="alert" style={{ color: 'var(--color-danger)' }}>
        <p>{error}</p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
          Retry
        </button>
      </div>
    )
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
      <div className="hierarchy-empty">
        <EmptyState
          title="This vault has no credentials yet"
          message="Add credentials to this service vault first. They will appear here, and related ones can be organized into parent and child groups."
          action={<Link to={`/app/vaults/${vaultId}`} className="app-primary-action">Open this vault</Link>}
        />
      </div>
    )
  }

  return (
    <div className="hierarchy-tree-panel">
      <div className="hierarchy-tree-panel__summary">
        <div>
          <strong>{nodes.length} top-level {nodes.length === 1 ? 'credential' : 'credentials'}</strong>
          <span>Expand a row to see related credentials, or open it to view details.</span>
        </div>
        <Link to={`/app/vaults/${vaultId}`} className="app-secondary-action">
          Open vault
        </Link>
      </div>
      <TreeView
        nodes={nodes}
        onNodeSelect={(node) => navigate(`/app/vaults/${vaultId}/items/${node.id}`)}
        onNodeExpand={handleExpand}
      />
    </div>
  )
}
