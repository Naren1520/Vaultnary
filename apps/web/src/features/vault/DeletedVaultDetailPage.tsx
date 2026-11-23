import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Topbar from '../../components/ui/Topbar'
import { apiGet } from '../../services/http-client'

interface DeletedVault {
  id: string
  name: string
  original_created_at: string
  destroyed_at: string
  reason: 'scheduled' | 'manual'
}

export default function DeletedVaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const [vault, setVault] = useState<DeletedVault | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!vaultId) return
    const controller = new AbortController()
    apiGet<{ data: DeletedVault }>(`/api/v1/vaults/deleted/${vaultId}`, { signal: controller.signal })
      .then((response) => setVault(response.data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load deleted vault details.')
        }
      })
    return () => controller.abort()
  }, [vaultId])

  if (error) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <p role="alert">{error}</p>
        <Link to="/app/deleted-vaults">Back to deleted vaults</Link>
      </div>
    )
  }
  if (!vault) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Deleted vaults', href: '/app/deleted-vaults' }, { label: vault.name, href: `/app/deleted-vaults/${vault.id}` }]} showSearch={false} />
      <main className="app-page-content" style={{ padding: 'var(--space-6)', maxWidth: 720 }}>
        <Link to="/app/deleted-vaults" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={16} /> Deleted vaults
        </Link>
        <header className="app-page-heading">
          <Trash2 size={22} aria-hidden="true" />
          <h1>{vault.name}</h1>
        </header>
        <dl>
          <dt>Vault ID</dt><dd><code>{vault.id}</code></dd>
          <dt>Original creation time</dt><dd>{new Date(vault.original_created_at).toLocaleString()}</dd>
          <dt>Deletion time</dt><dd>{new Date(vault.destroyed_at).toLocaleString()}</dd>
          <dt>Deletion reason</dt><dd>{vault.reason}</dd>
        </dl>
      </main>
    </div>
  )
}
