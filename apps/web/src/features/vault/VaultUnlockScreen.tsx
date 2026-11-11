import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../../services/http-client'
import { deriveKey } from '../../crypto/kdf'
import { decrypt, encrypt } from '../../crypto/symmetric'
import {
  exportPrivateKey,
  exportPublicKey,
  generateKekPair,
  importPrivateKey,
} from '../../crypto/asymmetric'
import { unlockVault } from '../../crypto/vault-session'

interface VaultKeyMaterial {
  configured: boolean
  salt?: string
  encrypted_private_key?: string
  legacy_item_count: number
}

interface VaultUnlockScreenProps {
  onUnlocked: () => void
}

const cardStyle = {
  width: 'min(100%, 28rem)',
  padding: 'clamp(1.5rem, 5vw, 2.5rem)',
  border: '1px solid #e7e7eb',
  borderRadius: '1.25rem',
  background: '#fff',
  boxShadow: '0 20px 60px rgba(21, 33, 54, 0.08)',
} as const

const fieldStyle = {
  width: '100%',
  minHeight: '3rem',
  padding: '0.75rem 0.9rem',
  border: '1px solid #d6d8df',
  borderRadius: '0.75rem',
  background: '#fff',
  color: '#171923',
} as const

const primaryButtonStyle = {
  display: 'flex',
  width: '100%',
  minHeight: '3rem',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  border: 0,
  borderRadius: '0.75rem',
  background: '#171923',
  color: '#fff',
  fontWeight: 600,
} as const

export default function VaultUnlockScreen({ onUnlocked }: VaultUnlockScreenProps) {
  const [material, setMaterial] = useState<VaultKeyMaterial | null>(null)
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [acknowledgedLegacyData, setAcknowledgedLegacyData] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiGet<{ data: VaultKeyMaterial }>('/api/v1/vault/key-material', {
      signal: controller.signal,
    })
      .then(({ data }) => setMaterial(data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load vault settings.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProfile(false)
      })
    return () => controller.abort()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!material) return

    if (masterPassword.length < 12 || masterPassword.length > 128) {
      setError('Use a master password between 12 and 128 characters.')
      return
    }
    if (!material.configured && masterPassword !== confirmation) {
      setError('The master passwords do not match.')
      return
    }
    if (!material.configured && material.legacy_item_count > 0 && !acknowledgedLegacyData) {
      setError('Review and acknowledge the legacy-data warning before continuing.')
      return
    }

    setWorking(true)
    try {
      if (material.configured) {
        await unlockExistingVault(masterPassword, material)
      } else {
        await initializeVault(masterPassword)
      }
      setMasterPassword('')
      setConfirmation('')
      onUnlocked()
    } catch {
      setError(
        material.configured
          ? 'Could not unlock the vault. Check your master password and try again.'
          : 'Could not initialize the vault securely. Please try again.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <section
      aria-labelledby="vault-lock-title"
      style={{
        display: 'grid',
        minHeight: 'min(76vh, 52rem)',
        placeItems: 'center',
        padding: 'clamp(1rem, 4vw, 3rem)',
        background:
          'radial-gradient(ellipse at 50% 5%, rgba(226, 235, 255, 0.82), transparent 54%), #f7f8fb',
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            display: 'grid',
            width: '3.25rem',
            height: '3.25rem',
            placeItems: 'center',
            marginBottom: '1.25rem',
            border: '1px solid #e8ebf3',
            borderRadius: '1rem',
            background: '#f5f7fb',
            color: '#244b9b',
          }}
        >
          <LockKeyhole size={23} aria-hidden="true" />
        </div>
        <p
          style={{
            marginBottom: '0.45rem',
            color: '#697386',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Private by design
        </p>
        <h1 id="vault-lock-title" style={{ color: '#171923', fontSize: '1.75rem', letterSpacing: '-0.04em' }}>
          {loadingProfile
            ? 'Preparing your vault'
            : material?.configured
              ? 'Unlock your vault'
              : 'Set up your vault'}
        </h1>
        <p style={{ marginTop: '0.65rem', color: '#687184', lineHeight: 1.65 }}>
          {material?.configured
            ? 'Your master password decrypts your private key on this device. It is never sent to Vaultnary.'
            : 'Create a separate master password. It encrypts your vault key locally and is not your sign-in password.'}
        </p>

        {loadingProfile ? (
          <p role="status" style={{ marginTop: '1.5rem', color: '#687184' }}>
            Loading secure vault settings…
          </p>
        ) : !material ? (
          <p role="alert" style={{ marginTop: '1.25rem', color: '#b42318' }}>
            {error || 'Vault settings are unavailable. Try reloading this page.'}
          </p>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}
          >
            {!material.configured && material.legacy_item_count > 0 && (
              <div
                role="note"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.7rem',
                  padding: '0.9rem',
                  border: '1px solid #f1d29a',
                  borderRadius: '0.75rem',
                  background: '#fff9ed',
                  color: '#794c0a',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                }}
              >
                <AlertTriangle size={18} aria-hidden="true" style={{ flex: '0 0 auto' }} />
                <span>
                  {material.legacy_item_count} existing credential
                  {material.legacy_item_count === 1 ? ' is' : 's are'} from before secure vault setup.
                  They will be preserved, but cannot be automatically re-encrypted. This setup will not
                  delete them.
                </span>
              </div>
            )}

            <label style={{ display: 'grid', gap: '0.45rem', color: '#303747', fontSize: '0.875rem', fontWeight: 600 }}>
              Master password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={masterPassword}
                onChange={(event) => setMasterPassword(event.target.value)}
                placeholder={material.configured ? 'Enter your master password' : 'At least 12 characters'}
                style={fieldStyle}
                disabled={working}
                required
              />
            </label>

            {!material.configured && (
              <>
                <label style={{ display: 'grid', gap: '0.45rem', color: '#303747', fontSize: '0.875rem', fontWeight: 600 }}>
                  Confirm master password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Enter it again"
                    style={fieldStyle}
                    disabled={working}
                    required
                  />
                </label>
                {material.legacy_item_count > 0 && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', color: '#545e70', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                    <input
                      type="checkbox"
                      checked={acknowledgedLegacyData}
                      onChange={(event) => setAcknowledgedLegacyData(event.target.checked)}
                      disabled={working}
                      style={{ marginTop: '0.2rem' }}
                    />
                    I understand these existing credentials are preserved but may not be recoverable in the new encrypted vault.
                  </label>
                )}
              </>
            )}

            {error && (
              <p role="alert" style={{ color: '#b42318', fontSize: '0.875rem' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={working} style={{ ...primaryButtonStyle, opacity: working ? 0.7 : 1 }}>
              <ShieldCheck size={17} aria-hidden="true" />
              {working
                ? material.configured ? 'Unlocking…' : 'Securing your vault…'
                : material.configured ? 'Unlock vault' : 'Create encrypted vault'}
            </button>
            <p style={{ color: '#818a99', fontSize: '0.75rem', textAlign: 'center' }}>
              Keep your master password safe. Vaultnary cannot recover it for you.
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

async function initializeVault(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const masterKey = await deriveKey(password, salt)
  const keyPair = await generateKekPair()
  const privateKeyBytes = await exportPrivateKey(keyPair.privateKey)
  try {
    const encryptedPrivateKey = await encrypt(masterKey, privateKeyBytes)
    const publicKey = await exportPublicKey(keyPair.publicKey)
    await apiPost('/api/v1/vault/key-material', {
      salt: toHex(salt),
      encrypted_private_key: toHex(encryptedPrivateKey),
      public_key: toHex(publicKey),
    })
    const privateKey = await importPrivateKey(privateKeyBytes)
    unlockVault(masterKey, privateKey)
  } finally {
    privateKeyBytes.fill(0)
  }
}

async function unlockExistingVault(password: string, material: VaultKeyMaterial): Promise<void> {
  if (!material.salt || !material.encrypted_private_key) {
    throw new Error('Vault key material is incomplete.')
  }
  const salt = fromHex(material.salt)
  const encryptedPrivateKey = fromHex(material.encrypted_private_key)
  if (salt.length !== 16 || encryptedPrivateKey.length < 64) {
    throw new Error('Vault key material is invalid.')
  }
  const masterKey = await deriveKey(password, salt)
  const privateKeyBytes = await decrypt(masterKey, encryptedPrivateKey)
  try {
    const privateKey = await importPrivateKey(privateKeyBytes)
    unlockVault(masterKey, privateKey)
  } finally {
    privateKeyBytes.fill(0)
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error('Invalid hexadecimal data.')
  }
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}
