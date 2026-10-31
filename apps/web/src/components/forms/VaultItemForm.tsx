import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../services/http-client'
import { sealItem } from '../../crypto/envelope'
import { useVaultStore } from '../../state/vault-store'
import { ValidationError } from '../../services/error-handler'
import Modal from '../ui/Modal'
import type { CredentialType } from '../ui/CredentialBadge'

/* Field definitions per credential type                               */

interface FieldDef {
  name: string
  label: string
  secret: boolean
}

const TYPE_FIELDS: Record<CredentialType, FieldDef[]> = {
  email: [{ name: 'address', label: 'Email Address', secret: false }],
  website: [
    { name: 'url', label: 'URL', secret: false },
    { name: 'username', label: 'Username', secret: false },
    { name: 'password', label: 'Password', secret: true },
  ],
  database: [
    { name: 'host', label: 'Host', secret: false },
    { name: 'port', label: 'Port', secret: false },
    { name: 'username', label: 'Username', secret: false },
    { name: 'database_name', label: 'Database Name', secret: false },
    { name: 'password', label: 'Password', secret: true },
  ],
  api_key: [{ name: 'key', label: 'API Key', secret: true }],
  token: [{ name: 'value', label: 'Token', secret: true }],
  ssh: [{ name: 'private_key', label: 'Private Key', secret: true }],
  service_account: [{ name: 'identifier', label: 'Identifier', secret: false }],
  totp: [{ name: 'secret', label: 'TOTP Secret', secret: true }],
  recovery_code: [{ name: 'code', label: 'Recovery Code', secret: true }],
  custom: [],
}

const ALL_TYPES: CredentialType[] = [
  'email',
  'website',
  'database',
  'api_key',
  'token',
  'ssh',
  'service_account',
  'totp',
  'recovery_code',
  'custom',
]

const TYPE_LABELS: Record<CredentialType, string> = {
  email: 'Email',
  website: 'Website',
  database: 'Database',
  api_key: 'API Key',
  token: 'Token',
  ssh: 'SSH',
  service_account: 'Service Account',
  totp: 'TOTP',
  recovery_code: 'Recovery Code',
  custom: 'Custom',
}

/* Component props                                                     */

interface VaultItemFormProps {
  /** When provided the form is in edit mode */
  itemId?: string
  onSuccess: (id: string) => void
}

interface ExistingItem {
  id: string
  name: string
  credential_type: CredentialType
  tags: string[]
  notes: string | null
}

interface CreateResponse {
  data: { id: string }
}

interface PublicKeyResponse {
  data: { public_key: string }
}

/* Helpers                                                             */

function importPublicKey(pem: string): Promise<CryptoKey> {
  /* Strip PEM header/footer and decode base64 */
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return crypto.subtle.importKey(
    'spki',
    buf.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
}

function uint8ToBase64(arr: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin)
}

/* VaultItemForm                                                        */

export default function VaultItemForm({ itemId, onSuccess }: VaultItemFormProps) {
  const isEditMode = Boolean(itemId)

  /* Core form state */
  const [name, setName] = useState('')
  const [credentialType, setCredentialType] = useState<CredentialType>('website')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [tagsRaw, setTagsRaw] = useState('')
  const [notes, setNotes] = useState('')

  /* UI state */
  const [submitting, setSubmitting] = useState(false)
  const [loadingItem, setLoadingItem] = useState(isEditMode)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const isUnlocked = useVaultStore((s) => s.isUnlocked)
  const privateKey = useVaultStore((s) => s.privateKey)

  /* Load existing item in edit mode */
  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    apiGet<{ data: ExistingItem }>(`/api/v1/vault/items/${itemId}`)
      .then((res) => {
        if (cancelled) return
        const item = res.data
        setName(item.name)
        setCredentialType(item.credential_type)
        setTagsRaw(item.tags.join(', '))
        setNotes(item.notes ?? '')
      })
      .catch(() => {
        if (!cancelled) setGlobalError('Failed to load item.')
      })
      .finally(() => {
        if (!cancelled) setLoadingItem(false)
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  /* Reset dynamic fields when type changes */
  useEffect(() => {
    setFieldValues({})
  }, [credentialType])

  function setField(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }))
  }

  function clearError(field: string) {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setGlobalError('')
    setSubmitting(true)

    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      /* Build payload_metadata from non-secret fields */
      const fields = TYPE_FIELDS[credentialType]
      const payloadMetadata: Record<string, string> = {}
      for (const f of fields) {
        if (!f.secret) payloadMetadata[f.name] = fieldValues[f.name] ?? ''
      }

      /* Encrypt secret fields if vault is unlocked */
      let encryptedPayload: string | undefined
      let encryptedDek: string | undefined

      const secretFields = fields.filter((f) => f.secret)
      if (secretFields.length > 0 && isUnlocked && privateKey) {
        /* Get our own public key from server to encrypt the DEK */
        try {
          const meRes = await apiGet<{ data: { id: string } }>('/api/v1/users/me').catch(
            () => null,
          )
          /* Fall back: use the in-memory private key's corresponding public key
             by fetching from /auth/public-keys -we need the user_id.
             If the endpoint is unavailable, skip encryption gracefully. */
          if (meRes) {
            const userId = meRes.data.id
            const pkRes = await apiGet<PublicKeyResponse>(
              `/api/v1/auth/public-keys/${userId}`,
            )
            const pubKey = await importPublicKey(pkRes.data.public_key)
            const secretPayload: Record<string, string> = {}
            for (const f of secretFields) {
              secretPayload[f.name] = fieldValues[f.name] ?? ''
            }
            const sealed = await sealItem(secretPayload, pubKey)
            encryptedPayload = uint8ToBase64(sealed.encryptedPayload)
            encryptedDek = uint8ToBase64(sealed.encryptedDek)
          }
        } catch {
          /* Encryption failed -still submit metadata without payload */
        }
      }

      const body = {
        name,
        credential_type: credentialType,
        tags,
        notes: notes || undefined,
        payload_metadata: payloadMetadata,
        encrypted_payload: encryptedPayload,
        encrypted_dek: encryptedDek,
      }

      let resultId: string

      if (isEditMode && itemId) {
        await apiPut(`/api/v1/vault/items/${itemId}`, body)
        resultId = itemId
      } else {
        const res = await apiPost<CreateResponse>('/api/v1/vault/items', body)
        resultId = res.data.id
      }

      onSuccess(resultId)
    } catch (err) {
      if (err instanceof ValidationError) {
        const errs: Record<string, string> = {}
        for (const fe of err.fieldErrors) {
          errs[fe.field] = fe.rule
        }
        setFieldErrors(errs)
      } else {
        setGlobalError(err instanceof Error ? err.message : 'An error occurred.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!itemId) return
    setSubmitting(true)
    try {
      await apiDelete(`/api/v1/vault/items/${itemId}`, { confirm: true })
      onSuccess('')
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setSubmitting(false)
      setShowDeleteModal(false)
    }
  }

  if (loadingItem) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Loading…
      </p>
    )
  }

  const fields = TYPE_FIELDS[credentialType]

  return (
    <>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '32rem' }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
          {isEditMode ? 'Edit credential' : 'New credential'}
        </h2>

        {/* Name */}
        <Field
          label="Name"
          error={fieldErrors['name']}
          required
        >
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError('name') }}
            placeholder="My credential"
            required
            style={inputStyle}
          />
        </Field>

        {/* Credential type */}
        <Field label="Type" error={fieldErrors['credential_type']}>
          <select
            value={credentialType}
            onChange={(e) => setCredentialType(e.target.value as CredentialType)}
            style={inputStyle}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        {/* Dynamic fields for selected type */}
        {fields.map((f) => (
          <Field
            key={f.name}
            label={f.label}
            error={fieldErrors[`payload_metadata.${f.name}`] ?? fieldErrors[f.name]}
          >
            <input
              type={f.secret ? 'password' : 'text'}
              value={fieldValues[f.name] ?? ''}
              onChange={(e) => { setField(f.name, e.target.value); clearError(`payload_metadata.${f.name}`) }}
              autoComplete={f.secret ? 'new-password' : undefined}
              style={inputStyle}
            />
          </Field>
        ))}

        {/* Tags */}
        <Field label="Tags" hint="Comma-separated" error={fieldErrors['tags']}>
          <input
            type="text"
            value={tagsRaw}
            onChange={(e) => { setTagsRaw(e.target.value); clearError('tags') }}
            placeholder="work, api, staging"
            style={inputStyle}
          />
        </Field>

        {/* Notes */}
        <Field label="Notes" error={fieldErrors['notes']}>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); clearError('notes') }}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        {globalError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
            {globalError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          {isEditMode && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={submitting}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: '#fff',
                backgroundColor: 'var(--color-danger)',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: '#fff',
              backgroundColor: 'var(--color-accent)',
              cursor: 'pointer',
            }}
          >
            {submitting ? 'Saving…' : isEditMode ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        title="Delete credential"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onClose={() => setShowDeleteModal(false)}
        destructive
      >
        Are you sure you want to permanently delete this credential? This action cannot be undone.
      </Modal>
    </>
  )
}

/* Internal field wrapper component                                    */

interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text)',
        }}
      >
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}> *</span>}
        {hint && (
          <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'var(--space-1)' }}>
            {hint}
          </span>
        )}
      </label>
      {children}
      {error && (
        <p role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  border: 'var(--border-input)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
  width: '100%',
  boxSizing: 'border-box',
}
