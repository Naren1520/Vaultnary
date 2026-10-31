import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/feedback/EmptyState'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import { apiGet, apiPost } from '../../services/http-client'
import { deriveKey } from '../../crypto/kdf'
import { encrypt } from '../../crypto/symmetric'
import { useVaultStore } from '../../state/vault-store'

interface RecoveryStatus {
  data: { configured: boolean }
}

function uint8ToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function RecoverySetup() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [passphraseConfirm, setPassphraseConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const privateKey = useVaultStore((s) => s.privateKey)
  const isUnlocked = useVaultStore((s) => s.isUnlocked)

  useEffect(() => {
    apiGet<RecoveryStatus>('/api/v1/recovery/setup')
      .then((r) => setConfigured(r.data.configured))
      .catch(() => setConfigured(false))
      .finally(() => setLoading(false))
  }, [])

  async function handleSetup() {
    setError('')
    if (passphrase.length < 12) {
      setError('Recovery passphrase must be at least 12 characters.')
      return
    }
    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match.')
      return
    }
    if (!isUnlocked || !privateKey) {
      setError('Vault must be unlocked to set up recovery.')
      return
    }

    setSaving(true)
    try {
      /* Export private key to raw bytes */
      let privateKeyBytes: ArrayBuffer
      try {
        privateKeyBytes = await crypto.subtle.exportKey('pkcs8', privateKey)
      } catch {
        setError('Cannot export private key — it may not be extractable.')
        return
      }

      /* Derive key from recovery passphrase */
      const salt = new Uint8Array(16)
      crypto.getRandomValues(salt)
      const recoveryKey = await deriveKey(passphrase, salt)

      /* Encrypt private key with recovery key */
      const plaintext = new Uint8Array(privateKeyBytes)
      const ciphertext = await encrypt(recoveryKey, plaintext)

      /* Compute integrity tag (first 16 bytes of ciphertext = auth tag in AES-GCM) */
      const integrityTag = ciphertext.slice(ciphertext.length - 16)

      const kdfParams = {
        algorithm: 'argon2id',
        memory_cost: 65536,
        time_cost: 3,
        parallelism: 4,
        salt: uint8ToHex(salt),
      }

      await apiPost('/api/v1/recovery/setup', {
        encrypted_private_key: uint8ToHex(ciphertext),
        integrity_tag: uint8ToHex(integrityTag),
        kdf_params: kdfParams,
      })

      setConfigured(true)
      setSuccess(true)
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery setup failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonLoader variant="line" />

  if (success || configured) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>
          Recovery configured
        </span>
        <button
          onClick={() => { setSuccess(false); setModalOpen(true) }}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Update
        </button>
      </div>
    )
  }

  return (
    <>
      <EmptyState
        title="Recovery not configured"
        message="If you lose access to your vault, a recovery passphrase lets you restore your private key. Set it up now."
        action={
          <button
            onClick={() => setModalOpen(true)}
            style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
          >
            Set up recovery
          </button>
        }
      />

      <Modal
        open={modalOpen}
        title="Set up recovery passphrase"
        confirmLabel="Save recovery key"
        onConfirm={() => void handleSetup()}
        onClose={() => setModalOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Choose a strong passphrase (12+ characters). Store it somewhere safe — you will need it to recover your vault if you lose access.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label htmlFor="recovery-passphrase" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              Recovery passphrase
            </label>
            <input
              id="recovery-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
              disabled={saving}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label htmlFor="recovery-passphrase-confirm" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              Confirm passphrase
            </label>
            <input
              id="recovery-passphrase-confirm"
              type="password"
              value={passphraseConfirm}
              onChange={(e) => setPassphraseConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={saving}
              style={{ padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}
            />
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
