import { useState } from 'react'
import { apiGet, apiPost } from '../../services/http-client'
import { isValidEmail } from '../../services/validation'
import { ValidationError, getErrorMessage } from '../../services/error-handler'
import { useVaultStore } from '../../state/vault-store'
import { encryptDek } from '../../crypto/asymmetric'
import { generateDek } from '../../crypto/envelope'

type Role = 'viewer' | 'editor' | 'co_owner'

interface InvitationFlowProps {
  itemId: string
  onSuccess?: () => void
}

function uint8ToBase64(arr: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin)
}

export default function InvitationFlow({ itemId, onSuccess }: InvitationFlowProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [submitting, setSubmitting] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)

  const privateKey = useVaultStore((s) => s.privateKey)
  const isUnlocked = useVaultStore((s) => s.isUnlocked)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')
    setGlobalError('')

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      let encryptedDek: string | undefined

      if (isUnlocked && privateKey) {
        try {
          /* Look up recipient's public key */
          const recipientRes = await apiGet<{ data: { id: string } }>(
            `/api/v1/users/lookup?email=${encodeURIComponent(email)}`,
          ).catch(() => null)

          if (recipientRes) {
            const pkRes = await apiGet<{ data: { public_key: string } }>(
              `/api/v1/auth/public-keys/${recipientRes.data.id}`,
            )
            /* Parse PEM public key */
            const pem = pkRes.data.public_key
            const b64 = pem
              .replace(/-----BEGIN PUBLIC KEY-----/, '')
              .replace(/-----END PUBLIC KEY-----/, '')
              .replace(/\s+/g, '')
            const bin = atob(b64)
            const spki = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) spki[i] = bin.charCodeAt(i)
            const pubKey = await crypto.subtle.importKey(
              'spki',
              spki.buffer as ArrayBuffer,
              { name: 'RSA-OAEP', hash: 'SHA-256' },
              false,
              ['encrypt'],
            )
            const dek = await generateDek()
            const wrapped = await encryptDek(dek, pubKey)
            encryptedDek = uint8ToBase64(wrapped)
          }
        } catch {
          /* Proceed without DEK encryption if key fetch fails */
        }
      }

      await apiPost(`/api/v1/vault/items/${itemId}/invitations`, {
        invitee_email: email,
        role,
        encrypted_dek: encryptedDek,
      })

      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      if (err instanceof ValidationError) {
        setEmailError(err.fieldErrors.find((fe) => fe.field === 'invitee_email')?.rule ?? '')
        setGlobalError(err.message)
      } else {
        setGlobalError(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <p style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>
        Invitation sent to {email}.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label htmlFor="invite-email" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>
          Recipient email
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'invite-email-error' : undefined}
          style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', width: '100%' }}
          disabled={submitting}
        />
        {emailError && (
          <span id="invite-email-error" role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
            {emailError}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label htmlFor="invite-role" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}
          disabled={submitting}
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="co_owner">Co-owner</option>
        </select>
      </div>

      {globalError && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
          {globalError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer', alignSelf: 'flex-end' }}
      >
        {submitting ? 'Sending…' : 'Send invitation'}
      </button>
    </form>
  )
}
