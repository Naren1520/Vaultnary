import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, ShieldAlert, Trash2 } from 'lucide-react'
import { apiDelete, apiGet } from '../../../services/http-client'
import { getErrorMessage } from '../../../services/error-handler'
import { useAuthStore } from '../../../state/auth-store'
import { useVaultStore } from '../../../state/vault-store'
import { decryptDek, encryptDek, importPublicKey } from '../../../crypto/asymmetric'

interface TransferCandidate {
  user_id: string
  email: string
  role: string
  is_workspace_member: boolean
  has_public_key: boolean
  public_key_fingerprint: string | null
}

interface WorkspacePreview {
  id: string
  name: string
  role: string
  owned_by_you: boolean
  remaining_members: number
  remaining_admins: number
  shared_credentials: number
  will_be_preserved: boolean
  requires_owner_transfer: boolean
  transfer_candidates: TransferCandidate[]
}

interface CredentialPreview {
  id: string
  name: string
  workspace_id: string
  shared_with: number
  will_be_deleted: boolean
  requires_transfer: boolean
  transfer_candidates: TransferCandidate[]
}

interface DeletionPreview {
  email: string
  deletion_scope: {
    workspace_count: number
    personal_credentials_to_delete: number
    shared_credentials_to_transfer: number
    shared_credentials_you_access: number
    projects_to_remove_or_transfer: number
    services_to_remove_or_transfer: number
    collaborators_to_notify: number
  }
  workspaces: WorkspacePreview[]
  owned_credentials: CredentialPreview[]
}

interface KeyEnvelopeResponse {
  data: {
    encrypted_dek: string
  }
}

interface PublicKeyResponse {
  data: {
    public_key: string
    fingerprint: string
  }
}

interface WorkspaceTransfer {
  workspace_id: string
  recipient_id: string
}

interface ItemTransfer {
  item_id: string
  recipient_id: string
  recipient_key_fingerprint: string
  encrypted_dek: string
}

function hexToBytes(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error('The encrypted credential key is malformed.')
  }
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function pemToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function wrapCredentialKey(
  itemId: string,
  recipientId: string,
  expectedFingerprint: string | null,
): Promise<{ encryptedDek: string; fingerprint: string }> {
  const privateKey = useVaultStore.getState().privateKey
  if (!privateKey) throw new Error('Unlock your vault before transferring shared credentials.')

  const [envelope, recipientKey] = await Promise.all([
    apiGet<KeyEnvelopeResponse>(`/api/v1/vault/items/${itemId}/key-envelope`),
    apiGet<PublicKeyResponse>(`/api/v1/auth/public-keys/${recipientId}`),
  ])
  if (!expectedFingerprint || recipientKey.data.fingerprint !== expectedFingerprint) {
    throw new Error('The recipient encryption key changed. Reload the deletion review and try again.')
  }
  const itemKey = await decryptDek(hexToBytes(envelope.data.encrypted_dek), privateKey)
  const publicKey = await importPublicKey(pemToBytes(recipientKey.data.public_key))
  return {
    encryptedDek: bytesToHex(await encryptDek(itemKey, publicKey)),
    fingerprint: recipientKey.data.fingerprint,
  }
}

export default function AccountDeletionSection() {
  const navigate = useNavigate()
  const clearCsrfToken = useAuthStore((state) => state.clearCsrfToken)
  const isVaultUnlocked = useVaultStore((state) => state.isUnlocked)
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [workspaceRecipients, setWorkspaceRecipients] = useState<Record<string, string>>({})
  const [itemRecipients, setItemRecipients] = useState<Record<string, string>>({})
  const [step, setStep] = useState<1 | 2>(1)
  const [currentPassword, setCurrentPassword] = useState('')
  const [typedConfirmation, setTypedConfirmation] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    apiGet<{ data: DeletionPreview }>('/api/v1/users/me/deletion-preview', {
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) setPreview(response.data)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(cause))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [retryCount])

  const transfersReady = useMemo(() => {
    if (!preview) return false
    const workspaceTransfersReady = preview.workspaces
      .filter((workspace) => workspace.requires_owner_transfer)
      .every((workspace) =>
        workspace.transfer_candidates.length > 0 && Boolean(workspaceRecipients[workspace.id]),
      )
    const remainingAdminsReady = preview.workspaces
      .filter((workspace) => !workspace.owned_by_you)
      .every((workspace) => workspace.remaining_admins > 0)
    const itemTransfersReady = preview.owned_credentials
      .filter((credential) => credential.requires_transfer)
      .every((credential) =>
        credential.transfer_candidates.length > 0 && Boolean(itemRecipients[credential.id]),
      )
    return workspaceTransfersReady && remainingAdminsReady && itemTransfersReady
  }, [itemRecipients, preview, workspaceRecipients])

  function getCandidate(
    candidates: TransferCandidate[],
    selectedId: string,
  ): TransferCandidate | undefined {
    return candidates.find((candidate) => candidate.user_id === selectedId)
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview || !acknowledged || typedConfirmation !== 'DELETE') return

    setSubmitting(true)
    setError('')
    try {
      const workspace_transfers: WorkspaceTransfer[] = preview.workspaces
        .filter((workspace) => workspace.requires_owner_transfer)
        .map((workspace) => ({
          workspace_id: workspace.id,
          recipient_id: workspaceRecipients[workspace.id],
        }))
      const item_transfers: ItemTransfer[] = await Promise.all(
        preview.owned_credentials
          .filter((credential) => credential.requires_transfer)
          .map(async (credential) => {
            const recipientId = itemRecipients[credential.id]
            const candidate = getCandidate(credential.transfer_candidates, recipientId)
            const wrapped = await wrapCredentialKey(
              credential.id,
              recipientId,
              candidate?.public_key_fingerprint ?? null,
            )
            return {
              item_id: credential.id,
              recipient_id: recipientId,
              recipient_key_fingerprint: wrapped.fingerprint,
              encrypted_dek: wrapped.encryptedDek,
            }
          }),
      )

      await apiDelete('/api/v1/users/me', {
        current_password: currentPassword,
        confirmation: typedConfirmation,
        workspace_transfers,
        item_transfers,
      })
      clearCsrfToken()
      useVaultStore.getState().lockVault()
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(getErrorMessage(cause))
      setSubmitting(false)
    }
  }

  return (
    <section className="profile-card profile-delete-card" aria-labelledby="profile-delete-title">
      <div className="profile-card-heading">
        <div className="profile-card-heading__icon profile-delete-icon">
          <Trash2 size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 id="profile-delete-title">Delete account</h2>
          <p>Review what will be removed and transfer any shared ownership first.</p>
        </div>
      </div>

      {loading ? (
        <p className="profile-muted" role="status">Preparing your account deletion review…</p>
      ) : loadError ? (
        <div>
          <p className="profile-alert" role="alert">{loadError}</p>
          <button
            className="profile-secondary-button"
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Try again
          </button>
        </div>
      ) : preview ? (
        <>
          <div className="profile-delete-warning">
            <ShieldAlert size={18} aria-hidden="true" />
            <p>
              Deletion is permanent. Your account credentials, sessions, recovery material,
              access to shared credentials, personal-only vault entries, and account-owned
              audit history will be removed.
              Shared workspaces and credentials with other authorized users will be retained
              and ownership transferred as selected below.
            </p>
          </div>

          <dl className="profile-delete-summary">
            <div><dt>Workspaces you belong to</dt><dd>{preview.deletion_scope.workspace_count}</dd></div>
            <div><dt>Personal credentials to delete</dt><dd>{preview.deletion_scope.personal_credentials_to_delete}</dd></div>
            <div><dt>Shared credentials to transfer</dt><dd>{preview.deletion_scope.shared_credentials_to_transfer}</dd></div>
            <div><dt>Shared credentials you can access</dt><dd>{preview.deletion_scope.shared_credentials_you_access}</dd></div>
            <div><dt>Projects owned by you</dt><dd>{preview.deletion_scope.projects_to_remove_or_transfer}</dd></div>
            <div><dt>Services owned by you</dt><dd>{preview.deletion_scope.services_to_remove_or_transfer}</dd></div>
            <div><dt>People to notify by email</dt><dd>{preview.deletion_scope.collaborators_to_notify}</dd></div>
          </dl>

          {preview.workspaces.length > 0 && (
            <div className="profile-delete-group">
              <h3>Workspaces</h3>
              {preview.workspaces.map((workspace) => (
                <div className="profile-delete-resource" key={workspace.id}>
                  <div>
                    <strong>{workspace.name}</strong>
                    <p>
                      Your role: {workspace.role}.{' '}
                      {workspace.will_be_preserved
                        ? `${workspace.remaining_members} other member(s); workspace and shared data will be preserved.`
                        : 'No other members or shared credentials; workspace data will be deleted.'}
                        {!workspace.owned_by_you && workspace.remaining_admins === 0 &&
                          ' No other owner or admin remains, so account deletion is blocked until an administrator is added.'}
                    </p>
                    {workspace.requires_owner_transfer && (
                        <p className="profile-field-hint">
                          The selected owner will control workspace membership and retained projects
                          and services. Credential access remains governed by each credential’s
                          individual permissions.
                        </p>
                    )}
                  </div>
                  {workspace.requires_owner_transfer && (
                    <label className="profile-field">
                      New workspace owner
                      <select
                        aria-label={`New owner for ${workspace.name}`}
                        value={workspaceRecipients[workspace.id] ?? ''}
                        onChange={(event) => setWorkspaceRecipients((current) => ({
                          ...current,
                          [workspace.id]: event.target.value,
                        }))}
                        disabled={submitting}
                      >
                        <option value="">Select an eligible member</option>
                        {workspace.transfer_candidates.map((candidate) => (
                          <option key={candidate.user_id} value={candidate.user_id}>
                            {candidate.email} ({candidate.role})
                          </option>
                        ))}
                      </select>
                      {workspace.transfer_candidates.length === 0 && (
                        <span className="profile-field-hint">
                          Add a verified member or collaborator before transferring this workspace.
                        </span>
                      )}
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          {preview.owned_credentials.length > 0 && (
            <div className="profile-delete-group">
              <h3>Credentials you own</h3>
              {preview.owned_credentials.map((credential) => (
                <div className="profile-delete-resource" key={credential.id}>
                  <div>
                    <strong>{credential.name}</strong>
                    <p>
                      {credential.will_be_deleted
                        ? 'Only you have access; this credential will be permanently deleted.'
                        : `Shared with ${credential.shared_with} user(s); the encrypted secret will be preserved and ownership transferred.`}
                    </p>
                  </div>
                  {credential.requires_transfer && (
                    <label className="profile-field">
                      New credential owner
                      <select
                        aria-label={`New owner for credential ${credential.name}`}
                        value={itemRecipients[credential.id] ?? ''}
                        onChange={(event) => setItemRecipients((current) => ({
                          ...current,
                          [credential.id]: event.target.value,
                        }))}
                        disabled={submitting}
                      >
                        <option value="">Select a verified user with an encryption key</option>
                        {credential.transfer_candidates.map((candidate) => (
                          <option key={candidate.user_id} value={candidate.user_id}>
                            {candidate.email} ({candidate.role})
                          </option>
                        ))}
                      </select>
                      {credential.transfer_candidates.length === 0 && (
                        <span className="profile-field-hint">
                          No eligible recipient has a registered encryption key. Add one before deleting this account.
                        </span>
                      )}
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="profile-delete-email-note">
            Vaultnary will queue a notification email to you and each affected collaborator.
            Emails never contain credential values or encryption keys.
            Projects and services owned by you in preserved workspaces transfer to the workspace
            owner; data in workspaces with no remaining collaborators or shared credentials is deleted.
          </p>

          {step === 1 ? (
            <div className="profile-form-actions">
              <span className="profile-field-hint">
                Review the affected data and choose new owners before continuing.
              </span>
              <button
                className="profile-danger-button"
                type="button"
                disabled={!transfersReady}
                onClick={() => {
                  setError('')
                  setStep(2)
                }}
              >
                <ArrowRightLeft size={15} aria-hidden="true" />
                Continue to confirmation
              </button>
            </div>
          ) : (
            <form className="profile-delete-confirmation" onSubmit={(event) => void handleDelete(event)}>
              <h3>Final confirmation</h3>
              {preview.deletion_scope.shared_credentials_to_transfer > 0 && (
                <p className="profile-field-hint" role="status">
                  Unlock your vault before deleting so shared credential keys can be safely
                  re-wrapped for their new owners in your browser.
                </p>
              )}
              <label className="profile-field">
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
              <label className="profile-field">
                Type DELETE to confirm
                <input
                  type="text"
                  autoComplete="off"
                  value={typedConfirmation}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
              <label className="profile-delete-acknowledgement">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  disabled={submitting}
                />
                I understand that account deletion is permanent and cannot be undone.
              </label>
              {error && <p className="profile-alert" role="alert">{error}</p>}
              <div className="profile-form-actions">
                <button
                  className="profile-secondary-button"
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setError('')
                  }}
                  disabled={submitting}
                >
                  Back to review
                </button>
                <button
                  className="profile-danger-button"
                  type="submit"
                  disabled={
                    submitting ||
                    !currentPassword ||
                    typedConfirmation !== 'DELETE' ||
                    !acknowledged ||
                    (preview.deletion_scope.shared_credentials_to_transfer > 0 &&
                      !isVaultUnlocked)
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {submitting ? 'Deleting account…' : 'Permanently delete account'}
                </button>
              </div>
            </form>
          )}
        </>
      ) : null}
    </section>
  )
}
