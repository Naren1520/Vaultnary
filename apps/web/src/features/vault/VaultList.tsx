import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useVaultStore } from '../../state/vault-store'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import CredentialBadge from '../../components/ui/CredentialBadge'
import { apiGet } from '../../services/http-client'
import { decryptVaultMetadata, type EncryptedVaultItem, type VaultItem } from './metadata'

interface ListResponse {
  data: EncryptedVaultItem[]
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
        <span style={{ color: 'var(--color-border)' }}>-</span>
      ),
    width: '9rem',
  },
]

interface VaultListProps {
  onCreateCredential: () => void
}

export default function VaultList({ onCreateCredential }: VaultListProps) {
  const navigate = useNavigate()
  const privateKey = useVaultStore((state) => state.privateKey)
  const [items, setItems] = useState<VaultItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()

    apiGet<ListResponse>('/api/v1/vault/items?limit=20', { signal: ctrl.signal })
      .then(async (res) => {
        if (!privateKey) throw new Error('Unlock the vault to view credentials.')
        const decrypted = await Promise.all(
          res.data.map((item) => decryptVaultMetadata(item, privateKey)),
        )
        if (!cancelled) setItems(decrypted)
      })
      .catch((err) => { if (!cancelled) setError(String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; ctrl.abort() }
  }, [privateKey])

  const filteredItems = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return search
      ? items.filter((item) =>
          [item.name, item.credential_type, ...item.tags]
            .some((value) => value.toLocaleLowerCase().includes(search)),
        )
      : items
  }, [items, query])

  if (loading) return <SkeletonLoader variant="table-row" rows={6} />
  if (error) return <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <label htmlFor="vault-local-search" className="sr-only">Search unlocked credentials</label>
      <input
        id="vault-local-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search unlocked credentials"
        style={{
          width: 'min(100%, 28rem)',
          padding: '0.7rem 0.9rem',
          border: 'var(--border-input)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg)',
        }}
      />
      {items.some((item) => item.legacy) && (
        <p role="status" style={{ color: 'var(--color-warning, #865d10)', fontSize: 'var(--text-sm)' }}>
          Legacy credentials are preserved, but their original names, tags, and notes are unavailable
          to encrypted search and cannot be migrated automatically.
        </p>
      )}
      <DataTable
        columns={columns}
        rows={filteredItems}
        getRowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/app/vault/${r.id}`)}
        caption="Vault credentials"
        emptyState={
          <EmptyState
            title={query ? 'No matching credentials' : 'Your vault is empty'}
            message={query ? 'Try another search or clear the filter to see all your credentials.' : 'Your encrypted workspace is ready. Add a credential to keep your first secret close and organized.'}
            icon={query ? undefined : <Plus size={25} />}
            action={!query ? (
              <button
                type="button"
                onClick={onCreateCredential}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.7rem 1rem',
                  border: 0,
                  borderRadius: '0.7rem',
                  background: '#1f2937',
                  color: '#fff',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add your first credential
              </button>
            ) : undefined}
          />
        }
      />
    </div>
  )
}
