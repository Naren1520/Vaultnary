import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { Download, GitBranch, Plus, Trash2, Upload } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import { useVaultStore } from '../../state/vault-store'
import { apiDelete, apiPost, apiPut } from '../../services/http-client'
import VaultUnlockScreen from './VaultUnlockScreen'
import VaultList from './VaultList'
import VaultItemForm from '../../components/forms/VaultItemForm'
import { verifyVaultArchive, type VaultArchive } from './archive'
import EnvImportDialog from './env-import/EnvImportDialog'

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
  const { vaultId } = useParams<{ vaultId: string }>()
  const isUnlocked = useVaultStore((s) => s.isUnlocked)
  const privateKey = useVaultStore((s) => s.privateKey)
  const [, forceUpdate] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [showEnvImport, setShowEnvImport] = useState(false)
  const [listKey, setListKey] = useState(0)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [archiveNotice, setArchiveNotice] = useState('')
  const [showDestruction, setShowDestruction] = useState(false)
  const [destroyAt, setDestroyAt] = useState('')
  const [destructionBusy, setDestructionBusy] = useState(false)
  const [destructionError, setDestructionError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function handleUnlocked() {
    forceUpdate((n) => n + 1)
  }

  async function handleScheduleDestruction() {
    if (!vaultId || !destroyAt) return
    setDestructionBusy(true)
    setDestructionError('')
    try {
      await apiPut(`/api/v1/vaults/${vaultId}/destruction`, {
        destroy_at: new Date(destroyAt).toISOString(),
      })
      setArchiveNotice('Timed destruction scheduled. You can cancel it before the scheduled time.')
      setShowDestruction(false)
    } catch (cause) {
      setDestructionError(cause instanceof Error ? cause.message : 'Could not schedule destruction.')
    } finally {
      setDestructionBusy(false)
    }
  }

  async function handleCancelDestruction() {
    if (!vaultId) return
    setDestructionBusy(true)
    setDestructionError('')
    try {
      await apiDelete(`/api/v1/vaults/${vaultId}/destruction`)
      setArchiveNotice('Scheduled destruction cancelled.')
      setShowDestruction(false)
    } catch (cause) {
      setDestructionError(cause instanceof Error ? cause.message : 'Could not cancel destruction.')
    } finally {
      setDestructionBusy(false)
    }
  }

  async function handleExport() {
    if (!vaultId) {
      setArchiveError('Select a service vault before exporting.')
      return
    }
    setArchiveBusy(true)
    setArchiveError('')
    setArchiveNotice('')
    try {
      const response = await apiPost<{ data: VaultArchive }>('/api/v1/vault/export', {
        vault_id: vaultId,
      })
      if (!response.data || response.data.version !== 2) {
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
    if (!vaultId) {
      setArchiveError('Select a service vault before importing an archive.')
      return
    }
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
      const response = await apiPost<{ data: { imported: number } }>('/api/v1/vault/import', {
        vault_id: vaultId,
        archive,
      })
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

  const handleEnvImportClose = useCallback(() => setShowEnvImport(false), [])
  const handleEnvImported = useCallback((count: number) => {
    setListKey((key) => key + 1)
    if (count > 0) {
      setArchiveNotice(`${count} environment variable${count === 1 ? '' : 's'} encrypted and imported.`)
      setArchiveError('')
    }
  }, [])

  if (!isUnlocked) {
    return <VaultUnlockScreen onUnlocked={handleUnlocked} />
  }
  if (!vaultId) {
    return (
      <div role="alert" style={{ padding: 'var(--space-4)', color: 'var(--color-danger)' }}>
        A service vault must be selected to open credential contents.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Topbar
        showSearch
        breadcrumbs={[
          { label: 'Vaults', href: '/app/vault' },
          { label: 'Service vault', href: `/app/vaults/${vaultId}` },
        ]}
        actionsSlot={
          <div className="vault-actions">
            <Link to={`/app/hierarchy/${vaultId}`} className="app-secondary-action">
              <GitBranch size={14} aria-hidden="true" />
              Credential hierarchy
            </Link>
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
              Import backup
            </button>
            <button
              type="button"
              onClick={() => setShowEnvImport(true)}
              style={actionStyle}
            >
              <Upload size={14} aria-hidden="true" />
              Import .env
            </button>
            <button
              type="button"
              onClick={() => setShowDestruction((current) => !current)}
              style={{ ...actionStyle, color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Timed destruction
            </button>
            <Link to="/app/deleted-vaults" className="app-secondary-action">
              Deleted vaults
            </Link>
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

      {showDestruction && (
        <div
          role="group"
          aria-label="Timed vault destruction"
          className="vault-destruction-card"
        >
          <div className="vault-destruction-card__heading">
            <span className="vault-destruction-card__icon" aria-hidden="true">
              <Trash2 size={18} />
            </span>
            <div>
              <strong>Timed vault destruction</strong>
              <p>Schedule deletion for this vault only. Related projects and other vaults stay safe.</p>
            </div>
          </div>
          <div className="vault-destruction-card__field">
            <label htmlFor="vault-destroy-at">Delete this vault on</label>
            <input
              id="vault-destroy-at"
              type="datetime-local"
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              value={destroyAt}
              onChange={(event) => setDestroyAt(event.target.value)}
              disabled={destructionBusy}
            />
          </div>
          {destructionError && (
            <p role="alert" className="vault-destruction-card__error">{destructionError}</p>
          )}
          <div className="vault-destruction-card__actions">
            <button
              type="button"
              className="app-primary-action"
              disabled={destructionBusy || !destroyAt}
              onClick={handleScheduleDestruction}
            >
              <Trash2 size={15} aria-hidden="true" />
              {destructionBusy ? 'Saving…' : 'Schedule deletion'}
            </button>
            <button
              type="button"
              className="app-secondary-action vault-destruction-card__cancel"
              disabled={destructionBusy}
              onClick={handleCancelDestruction}
            >
              Cancel scheduled deletion
            </button>
          </div>
        </div>
      )}

      <div className="vault-page-content" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          <header className="app-page-heading">
            <p className="app-page-heading__eyebrow">Private by design</p>
            <h1>Service vault</h1>
            <p>Encrypted credentials for this service.</p>
          </header>
          <VaultList
            key={`${vaultId}:${listKey}`}
            vaultId={vaultId}
            onCreateCredential={() => setShowCreate(true)}
          />
        </div>
      </div>

      {/* Create credential modal */}
      {showCreate && (
        <div
          role="presentation"
          className="app-modal-overlay"
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
            className="app-modal-panel"
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
            <VaultItemForm vaultId={vaultId} onSuccess={handleCreated} />
          </div>
        </div>
      )}
      {showEnvImport && (
        <EnvImportDialog
          vaultId={vaultId}
          onClose={handleEnvImportClose}
          onImported={handleEnvImported}
        />
      )}
    </div>
  )
}
