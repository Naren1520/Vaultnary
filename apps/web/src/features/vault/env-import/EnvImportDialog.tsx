import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FileUp, LockKeyhole, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../../../services/http-client'
import { importPublicKey } from '../../../crypto/asymmetric'
import { sealItem } from '../../../crypto/envelope'
import { useVaultStore } from '../../../state/vault-store'
import { decodeHex } from '../metadata'
import { MAX_ENV_FILE_BYTES, parseEnv } from './parseEnv'
import { detectCsvFormat, parseCsv } from './parseCsv'

interface EnvImportDialogProps {
  onClose: () => void
  onImported: (count: number) => void
}

interface PublicKeyResponse {
  data: { public_key: string }
}

interface CreateResponse {
  data: { imported: number }
}

const MAX_ENCRYPTED_ITEM_BYTES = 64 * 1024

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export default function EnvImportDialog({ onClose, onImported }: EnvImportDialogProps) {
  const privateKey = useVaultStore((state) => state.privateKey)
  const [source, setSource] = useState('')
  const [format, setFormat] = useState<'auto' | 'env' | 'csv'>('auto')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [showValues, setShowValues] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const busyRef = useRef(false)
  const effectiveFormat = useMemo(
    () => format === 'auto' ? detectCsvFormat(source) ? 'csv' : 'env' : format,
    [format, source],
  )
  const parsed = useMemo(
    () => effectiveFormat === 'csv' ? parseCsv(source) : parseEnv(source),
    [effectiveFormat, source],
  )
  const selectedVariables = parsed.variables.filter(({ key }) => selectedKeys.has(key))

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]):not([hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  function updateSource(value: string, selectedFormat: 'auto' | 'env' | 'csv' = format) {
    const detectedFormat = selectedFormat === 'auto'
      ? detectCsvFormat(value) ? 'csv' : 'env'
      : selectedFormat
    const nextParsed = detectedFormat === 'csv' ? parseCsv(value) : parseEnv(value)
    setSource(value)
    setFormat(selectedFormat)
    setSelectedKeys(new Set(nextParsed.variables.map(({ key }) => key)))
    setError('')
    setShowValues(false)
    setProgress('')
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (file.size > MAX_ENV_FILE_BYTES) {
      updateSource('', file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'env')
      setError('The selected file exceeds the 1 MB limit.')
      return
    }

    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      updateSource(
        await file.text(),
        extension === 'csv' ? 'csv' : extension === 'env' ? 'env' : 'auto',
      )
    } catch {
      updateSource('', file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'auto')
      setError('Could not read the selected file. Try pasting its contents instead.')
    }
  }

  function toggleVariable(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleImport() {
    if (busyRef.current) return
    setError('')
    if (!privateKey) {
      setError('Unlock the vault before importing environment variables.')
      return
    }
    if (parsed.issues.length > 0) {
      setError('Fix the environment file issues before importing to avoid silently missing variables.')
      return
    }
    if (selectedVariables.length === 0) {
      setError('Select at least one variable to import.')
      return
    }

    busyRef.current = true
    setBusy(true)
    let failedKey: string | null = null
    try {
      const user = await apiGet<{ data: { id: string } }>('/api/v1/users/me')
      const keyResponse = await apiGet<PublicKeyResponse>(
        `/api/v1/auth/public-keys/${encodeURIComponent(user.data.id)}`,
      )
      const publicKey = await importPublicKey(decodeHex(keyResponse.data.public_key))
      const encryptedItems: Array<{
        encrypted_metadata: string
        encrypted_payload: string
        encrypted_dek: string
      }> = []

      for (const [index, variable] of selectedVariables.entries()) {
        setProgress(`Encrypting and importing ${index + 1} of ${selectedVariables.length}…`)
        try {
          const sealed = await sealItem(
            { value: variable.value },
            {
              name: variable.key,
              credential_type: 'custom',
              tags: ['env'],
              notes: null,
              payload_metadata: null,
            },
            publicKey,
          )
          if (
            sealed.encryptedPayload.byteLength > MAX_ENCRYPTED_ITEM_BYTES ||
            sealed.encryptedMetadata.byteLength > MAX_ENCRYPTED_ITEM_BYTES
          ) {
            throw new Error('The encrypted value exceeds the vault item size limit.')
          }
          encryptedItems.push({
            encrypted_metadata: bytesToBase64(sealed.encryptedMetadata),
            encrypted_payload: bytesToBase64(sealed.encryptedPayload),
            encrypted_dek: bytesToBase64(sealed.encryptedDek),
          })
        } catch (cause) {
          failedKey = variable.key
          if (cause instanceof Error) throw cause
          throw new Error('Could not encrypt this environment variable.')
        }
      }

      failedKey = null
      setProgress('Saving all encrypted variables together…')
      const response = await apiPost<CreateResponse>('/api/v1/vault/import-env', {
        items: encryptedItems,
      })
      if (response.data.imported !== encryptedItems.length) {
        throw new Error('The server returned an unexpected import count. Verify the vault before retrying.')
      }

      onImported(response.data.imported)
      onClose()
    } catch (cause) {
      setError(
        failedKey
          ? `Could not prepare "${failedKey}". Nothing was saved. ${cause instanceof Error ? cause.message : 'Check the value and retry.'}`
          : cause instanceof Error
            ? `Nothing was imported. ${cause.message}`
            : 'Nothing was imported. Could not import environment variables.',
      )
      setProgress('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div
      className="env-import-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="env-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="env-import-title"
        tabIndex={-1}
      >
        <header className="env-import-heading">
          <div className="env-import-heading__icon"><LockKeyhole size={19} aria-hidden="true" /></div>
          <div>
            <p className="app-page-heading__eyebrow">Encrypted on this device</p>
            <h2 id="env-import-title">Import environment variables</h2>
            <p>Paste or select a .env or CSV file. Values are encrypted in your browser before they are sent to the server.</p>
            <p>Each selected variable becomes its own custom credential, named after the variable.</p>
          </div>
        </header>

        <div className="env-import-file-row">
          <input
            ref={fileInput}
            type="file"
            accept=".env,.txt,.csv,text/plain,text/csv"
            aria-label="Choose an environment file"
            onChange={(event) => { void handleFileChange(event) }}
            hidden
          />
          <button type="button" className="env-import-secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            <FileUp size={16} aria-hidden="true" />
            Choose file
          </button>
          <label className="env-import-format-label" htmlFor="env-import-format">Format</label>
          <select
            id="env-import-format"
            value={format}
            onChange={(event) => {
              const nextFormat = event.target.value === 'csv' || event.target.value === 'env'
                ? event.target.value
                : 'auto'
              setFormat(nextFormat)
              setError('')
              setShowValues(false)
              const nextEffectiveFormat = nextFormat === 'auto'
                ? detectCsvFormat(source) ? 'csv' : 'env'
                : nextFormat
              setSelectedKeys(new Set(
                (nextEffectiveFormat === 'csv' ? parseCsv(source) : parseEnv(source))
                  .variables.map(({ key }) => key),
              ))
            }}
            disabled={busy}
          >
            <option value="auto">Auto-detect</option>
            <option value="env">.env</option>
            <option value="csv">CSV</option>
          </select>
          <span>Maximum 1 MB, up to 100 variables</span>
        </div>

        <label className="env-import-label" htmlFor="env-import-source">
          Environment file contents
        </label>
        <textarea
          id="env-import-source"
          value={source}
          onChange={(event) => updateSource(event.target.value)}
          placeholder={effectiveFormat === 'csv'
            ? 'NAME,VALUE\nDATABASE_URL,"postgres://..."\nAPI_KEY,"paste-your-secret"'
            : 'DATABASE_URL=postgres://...\nAPI_KEY="paste-your-secret"'}
          rows={7}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
        />

        {parsed.issues.length > 0 && (
          <div className="env-import-issues" role="alert">
            <strong>Resolve these lines before importing:</strong>
            <ul>
              {parsed.issues.map((issue, index) => (
                <li key={`${issue.line}-${index}`}>Line {issue.line}: {issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.variables.length > 0 && parsed.issues.length === 0 && (
          <div className="env-import-preview">
            <div className="env-import-preview__heading">
              <strong>Review variables</strong>
              <div>
                <button
                  type="button"
                  className="env-import-reveal-button"
                  aria-pressed={showValues}
                  onClick={() => setShowValues((shown) => !shown)}
                  disabled={busy}
                >
                  {showValues ? 'Hide values' : 'Reveal values'}
                </button>
                <span>{selectedVariables.length} of {parsed.variables.length} selected</span>
              </div>
            </div>
            <ul>
              {parsed.variables.map(({ key, value }) => (
                <li key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggleVariable(key)}
                      disabled={busy}
                    />
                    <code>{key}</code>
                  </label>
                  <span className="env-import-preview__value" title={`${value.length} characters`}>
                    {value.length === 0 ? 'Empty value' : showValues ? value : '••••••••'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="env-import-security-note">
          <ShieldCheck size={16} aria-hidden="true" />
          Plaintext values stay in this page and are never included in API requests.
        </p>

        {(error || progress) && (
          <p className={error ? 'env-import-error' : 'env-import-status'} role={error ? 'alert' : 'status'}>
            {error || progress}
          </p>
        )}

        <footer className="env-import-actions">
          <button type="button" className="env-import-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="env-import-primary"
            onClick={() => { void handleImport() }}
            disabled={
              busy ||
              parsed.issues.length > 0 ||
              selectedVariables.length === 0
            }
          >
            {busy ? 'Importing…' : `Encrypt and import ${selectedVariables.length || ''}`.trim()}
          </button>
        </footer>
      </section>
    </div>
  )
}
