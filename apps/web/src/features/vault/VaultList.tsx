import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useVaultStore } from '../../state/vault-store'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'
import { decryptVaultMetadata, formatVaultDate, type EncryptedVaultItem, type VaultItem } from './metadata'

interface ListResponse {
  data: EncryptedVaultItem[]
  cursor: string | null
}

interface VaultListProps {
  vaultId: string
  onCreateCredential: () => void
}

export default function VaultList({ vaultId, onCreateCredential }: VaultListProps) {
  const navigate = useNavigate()
  const privateKey = useVaultStore((state) => state.privateKey)
  const [items, setItems] = useState<VaultItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()

    apiGet<ListResponse>(
      `/api/v1/vault/items?vault_id=${encodeURIComponent(vaultId)}&limit=20`,
      { signal: ctrl.signal },
    )
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
  }, [privateKey, vaultId])

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
    <div className="vault-list-content" style={{ display: 'grid', gap: '1rem' }}>
      <label htmlFor="vault-local-search" className="sr-only">Filter credentials in this vault</label>
      <input
        id="vault-local-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter credentials in this vault"
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
      {filteredItems.length === 0 ? (
        <EmptyState
          title={query ? 'No matching credentials' : 'Your vault is empty'}
          message={query ? 'Try another search or clear the filter to see all your credentials.' : 'Your encrypted workspace is ready. Add a credential to keep your first secret close and organized.'}
          icon={query ? undefined : <Plus size={25} />}
          action={!query ? (
            <button
              type="button"
              className="app-primary-action"
              onClick={onCreateCredential}
            >
              <Plus size={16} aria-hidden="true" />
              Add your first credential
            </button>
          ) : undefined}
        />
      ) : (
        <ul className="credential-card-grid" aria-label="Vault credentials">
          {filteredItems.map((item) => {
            const lastUsed = formatVaultDate(item.last_accessed_at)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="credential-card"
                  onClick={() => navigate(`/app/vaults/${vaultId}/items/${item.id}`)}
                >
                  <span className="credential-card__body">
                    <span className="credential-card__heading">
                      <strong>{item.name}</strong>
                      {item.credential_type !== 'custom' && (
                        <span className="credential-card__type">
                          {item.credential_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </span>
                    {item.tags.length > 0 && (
                      <span className="credential-card__tags">{item.tags.join(' · ')}</span>
                    )}
                  </span>
                  <span className="credential-card__meta">
                    {item.last_accessed_at
                      ? lastUsed
                        ? `Used ${lastUsed}`
                        : 'Usage date unavailable'
                      : 'Never used'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
