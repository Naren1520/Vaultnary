import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import CredentialBadge, { CredentialType } from '../../components/ui/CredentialBadge'
import { apiGet } from '../../services/http-client'
import { useVaultStore } from '../../state/vault-store'
import { decryptVaultMetadata, type EncryptedVaultItem, type VaultItem } from './metadata'
import SecretField from './SecretField'

interface VaultItemMeta extends EncryptedVaultItem {
  last_accessed_at: string | null
  inherited_from: { id: string; name: string } | null
}

const SECRET_CREDENTIAL_TYPES = new Set<CredentialType>([
  'website',
  'database',
  'api_key',
  'token',
  'ssh',
  'totp',
  'recovery_code',
  'custom',
])

interface DetailResponse {
  data: VaultItemMeta
}

export default function VaultItemDetail() {
  const { itemId } = useParams<{ itemId: string }>()
  const privateKey = useVaultStore((state) => state.privateKey)
  const [item, setItem] = useState<(VaultItem & Pick<VaultItemMeta, 'inherited_from'>) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    const ctrl = new AbortController()

    setLoading(true)
    setError('')
    apiGet<DetailResponse>(`/api/v1/vault/items/${itemId}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!privateKey) throw new Error('Unlock the vault to view this credential.')
        const metadata = await decryptVaultMetadata(res.data, privateKey)
        if (!cancelled) setItem({ ...metadata, inherited_from: res.data.inherited_from })
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setItem(null)
          setError(cause instanceof Error ? cause.message : 'Could not decrypt credential metadata.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; ctrl.abort() }
  }, [itemId, privateKey])

  if (loading) return <SkeletonLoader variant="detail-panel" />

  if (!item) {
    return (
      <div role="alert" style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        {error || 'Item not found or access denied.'}
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <CredentialBadge type={item.credential_type} />
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
          {item.name}
        </h2>
      </div>

      {item.inherited_from && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Inherited access from: <em>{item.inherited_from.name}</em>
        </p>
      )}

      {item.legacy && (
        <p role="status" style={{ color: 'var(--color-warning, #865d10)', fontSize: 'var(--text-sm)' }}>
          This credential predates encrypted metadata. Its original metadata cannot be recovered
          automatically; the existing record and any encrypted secret have been preserved.
        </p>
      )}

      {item.payload_metadata && Object.entries(item.payload_metadata).map(([key, value]) => (
        <div key={key}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>
            {typeof value === 'string' ? value : JSON.stringify(value)}
          </p>
        </div>
      ))}

      {SECRET_CREDENTIAL_TYPES.has(item.credential_type) && (
        <SecretField itemId={item.id} label="Secret" />
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Tags</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {item.tags.map((tag) => (
              <span key={tag} style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', border: 'var(--border-card)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Notes</p>
          <p style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>{item.notes}</p>
        </div>
      )}

      {/* Metadata */}
      <div style={{ borderTop: 'var(--border-card)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {item.last_accessed_at && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Last accessed: {new Date(item.last_accessed_at).toLocaleString()}
          </p>
        )}
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Created: {new Date(item.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
