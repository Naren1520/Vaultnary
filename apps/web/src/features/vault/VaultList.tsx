import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import CredentialBadge, { CredentialType } from '../../components/ui/CredentialBadge'
import { apiGet } from '../../services/http-client'

interface VaultItem {
  id: string
  name: string
  credential_type: CredentialType
  tags: string[]
  last_accessed_at: string | null
  created_at: string
}

interface ListResponse {
  data: VaultItem[]
  cursor: string | null
}

const columns: Column<VaultItem>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    render: (row) => <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{row.name}</span>,
  },
  {
    key: 'credential_type',
    header: 'Type',
    render: (row) => <CredentialBadge type={row.credential_type} size="sm" />,
    width: '10rem',
  },
  {
    key: 'tags',
    header: 'Tags',
    render: (row) => (
      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
        {row.tags.join(', ')}
      </span>
    ),
  },
  {
    key: 'last_accessed_at',
    header: 'Last accessed',
    sortable: true,
    render: (row) =>
      row.last_accessed_at ? (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
          {new Date(row.last_accessed_at).toLocaleDateString()}
        </span>
      ) : (
        <span style={{ color: 'var(--color-border)' }}>—</span>
      ),
    width: '9rem',
  },
]

export default function VaultList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<VaultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()

    apiGet<ListResponse>('/api/v1/vault/items?limit=20', { signal: ctrl.signal })
      .then((res) => { if (!cancelled) setItems(res.data) })
      .catch((err) => { if (!cancelled) setError(String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; ctrl.abort() }
  }, [])

  if (loading) return <SkeletonLoader variant="table-row" rows={6} />
  if (error) return <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>

  return (
    <DataTable
      columns={columns}
      rows={items}
      getRowKey={(r) => r.id}
      onRowClick={(r) => navigate(`/app/vault/${r.id}`)}
      caption="Vault credentials"
      emptyState={
        <EmptyState
          title="Your vault is empty"
          message="Add your first credential to get started."
        />
      }
    />
  )
}
