import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import CredentialBadge, { CredentialType } from '../../components/ui/CredentialBadge'
import { apiGet } from '../../services/http-client'
import SecretField from './SecretField'

interface VaultItemMeta {
  id: string
  name: string
  credential_type: CredentialType
  tags: string[]
  notes: string | null
  last_accessed_at: string | null
  created_at: string
  updated_at: string
  inherited_from: { id: string; name: string } | null
}

interface DetailResponse {
  data: VaultItemMeta
}

export default function VaultItemDetail() {
  const { itemId } = useParams<{ itemId: string }>()
  const [item, setItem] = useState<VaultItemMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    const ctrl = new AbortController()

    setLoading(true)
    apiGet<DetailResponse>(`/api/v1/vault/items/${itemId}`, { signal: ctrl.signal })
      .then((res) => { if (!cancelled) setItem(res.data) })
      .catch(() => { if (!cancelled) setItem(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; ctrl.abort() }
  }, [itemId])

  if (loading) return <SkeletonLoader variant="detail-panel" />

  if (!item) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Item not found or access denied.
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

      {/* Secret field -decrypt wired in Task 21 */}
      <SecretField itemId={item.id} label="Secret" />

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
