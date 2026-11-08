import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Plus, Upload } from 'lucide-react'
import Topbar from '../../components/ui/Topbar'
import Inspector from '../../components/ui/Inspector'
import EmptyState from '../../components/feedback/EmptyState'
import { useVaultStore } from '../../state/vault-store'
import { apiPost } from '../../services/http-client'
import VaultUnlockScreen from './VaultUnlockScreen'
import VaultList from './VaultList'
import VaultItemForm from '../../components/forms/VaultItemForm'
import { verifyVaultArchive, type VaultArchive } from './archive'

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024

const actionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
  border: 'var(--border-card)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
} as const

export default function VaultPage() {
  const isUnlocked = useVaultStore((s) => s.isUnlocked)
  const privateKey = useVaultStore((s) => s.privateKey)
  const [, forceUpdate] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [listKey, setListKey] = useState(0)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [archiveNotice, setArchiveNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function handleUnlocked() {
    forceUpdate((n) => n + 1)
  }

  async function handleExport() {
    setArchiveBusy(true)
    setArchiveError('')
    setArchiveNotice('')
    try {
      const response = await apiPost<{ data: VaultArchive }>('/api/v1/vault/export')
      if (!response.data || response.data.version !== 1) {
        throw new Error('The server returned an invalid vault archive.')
      }
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vaultnary-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setArchiveNotice('Vault backup downloaded; secret values remain encrypted.')
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : 'Could not export the vault.')
    } finally {
      setArchiveBusy(false)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!privateKey) {
      setArchiveError('Unlock the vault before importing an archive.')
      return
    }
    if (file.size > MAX_ARCHIVE_BYTES) {
      setArchiveError('Archive file exceeds the 50 MB limit.')
      return
    }

    setArchiveBusy(true)
    setArchiveError('')
    setArchiveNotice('')
    try {
      const archive = await verifyVaultArchive(JSON.parse(await file.text()) as unknown, privateKey)
      const response = await apiPost<{ data: { imported: number } }>('/api/v1/vault/import', archive)
      setListKey((key) => key + 1)
      setArchiveNotice(`${response.data.imported} credential${response.data.imported === 1 ? '' : 's'} imported.`)
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : 'Could not import the vault archive.')
    } finally {
      setArchiveBusy(false)
    }
  }

  function handleCreated(id: string) {
    setShowCreate(false)
    if (id) setListKey((k) => k + 1) // re-mount VaultList to refresh
  }

  if (!isUnlocked) {
    return <VaultUnlockScreen onUnlocked={handleUnlocked} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Topbar
        breadcrumbs={[{ label: 'Vault', href: '/app/vault' }]}
        actionsSlot={
          <div className="vault-actions">
            <button type="button" onClick={handleExport} disabled={archiveBusy} style={actionStyle}>
              <Download size={14} aria-hidden="true" />
              Export
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={archiveBusy}
              style={actionStyle}
            >
              <Upload size={14} aria-hidden="true" />
              Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              aria-label="Import encrypted vault archive"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                ...actionStyle,
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--color-text)',
                color: '#fff',
                border: 'none',
              }}
            >
              <Plus size={14} aria-hidden="true" />
              New credential
            </button>
          </div>
        }
      />

      {(archiveError || archiveBusy || archiveNotice) && (
        <div
          role={archiveError ? 'alert' : 'status'}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            color: archiveError ? 'var(--color-danger)' : 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {archiveError || (archiveBusy ? 'Processing archive...' : archiveNotice)}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          <VaultList key={listKey} />
        </div>
        <Inspector>
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState title="Nothing selected" message="Click a credential to view its details." />
          </div>
        </Inspector>
      </div>

      {/* Create credential modal */}
      {showCreate && (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 200,
            padding: 'var(--space-8) var(--space-4)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg)',
              border: 'var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              width: '100%',
              maxWidth: '36rem',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowCreate(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 'var(--space-4)',
                right: 'var(--space-4)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                fontSize: '1.25rem',
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <VaultItemForm onSuccess={handleCreated} />
          </div>
        </div>
      )}
    </div>
  )
}
