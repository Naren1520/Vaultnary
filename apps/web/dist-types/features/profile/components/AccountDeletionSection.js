import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, ShieldAlert, Trash2 } from 'lucide-react';
import { apiDelete, apiGet } from '../../../services/http-client';
import { getErrorMessage } from '../../../services/error-handler';
import { useAuthStore } from '../../../state/auth-store';
import { useVaultStore } from '../../../state/vault-store';
import { decryptDek, encryptDek, importPublicKey } from '../../../crypto/asymmetric';
function hexToBytes(value) {
    if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
        throw new Error('The encrypted credential key is malformed.');
    }
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < value.length; index += 2) {
        bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
    }
    return bytes;
}
function bytesToHex(value) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function pemToBytes(value) {
    const base64 = value
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s+/g, '');
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function wrapCredentialKey(itemId, recipientId, expectedFingerprint) {
    const privateKey = useVaultStore.getState().privateKey;
    if (!privateKey)
        throw new Error('Unlock your vault before transferring shared credentials.');
    const [envelope, recipientKey] = await Promise.all([
        apiGet(`/api/v1/vault/items/${itemId}/key-envelope`),
        apiGet(`/api/v1/auth/public-keys/${recipientId}`),
    ]);
    if (!expectedFingerprint || recipientKey.data.fingerprint !== expectedFingerprint) {
        throw new Error('The recipient encryption key changed. Reload the deletion review and try again.');
    }
    const itemKey = await decryptDek(hexToBytes(envelope.data.encrypted_dek), privateKey);
    const publicKey = await importPublicKey(pemToBytes(recipientKey.data.public_key));
    return {
        encryptedDek: bytesToHex(await encryptDek(itemKey, publicKey)),
        fingerprint: recipientKey.data.fingerprint,
    };
}
export default function AccountDeletionSection() {
    const navigate = useNavigate();
    const clearCsrfToken = useAuthStore((state) => state.clearCsrfToken);
    const isVaultUnlocked = useVaultStore((state) => state.isUnlocked);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [workspaceRecipients, setWorkspaceRecipients] = useState({});
    const [itemRecipients, setItemRecipients] = useState({});
    const [step, setStep] = useState(1);
    const [currentPassword, setCurrentPassword] = useState('');
    const [typedConfirmation, setTypedConfirmation] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setLoadError('');
        apiGet('/api/v1/users/me/deletion-preview', {
            signal: controller.signal,
        })
            .then((response) => {
            if (!controller.signal.aborted)
                setPreview(response.data);
        })
            .catch((cause) => {
            if (!controller.signal.aborted) {
                setLoadError(getErrorMessage(cause));
            }
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [retryCount]);
    const transfersReady = useMemo(() => {
        if (!preview)
            return false;
        const workspaceTransfersReady = preview.workspaces
            .filter((workspace) => workspace.requires_owner_transfer)
            .every((workspace) => workspace.transfer_candidates.length > 0 && Boolean(workspaceRecipients[workspace.id]));
        const remainingAdminsReady = preview.workspaces
            .filter((workspace) => !workspace.owned_by_you)
            .every((workspace) => workspace.remaining_admins > 0);
        const itemTransfersReady = preview.owned_credentials
            .filter((credential) => credential.requires_transfer)
            .every((credential) => credential.transfer_candidates.length > 0 && Boolean(itemRecipients[credential.id]));
        return workspaceTransfersReady && remainingAdminsReady && itemTransfersReady;
    }, [itemRecipients, preview, workspaceRecipients]);
    function getCandidate(candidates, selectedId) {
        return candidates.find((candidate) => candidate.user_id === selectedId);
    }
    async function handleDelete(event) {
        event.preventDefault();
        if (!preview || !acknowledged || typedConfirmation !== 'DELETE')
            return;
        setSubmitting(true);
        setError('');
        try {
            const workspace_transfers = preview.workspaces
                .filter((workspace) => workspace.requires_owner_transfer)
                .map((workspace) => ({
                workspace_id: workspace.id,
                recipient_id: workspaceRecipients[workspace.id],
            }));
            const item_transfers = await Promise.all(preview.owned_credentials
                .filter((credential) => credential.requires_transfer)
                .map(async (credential) => {
                const recipientId = itemRecipients[credential.id];
                const candidate = getCandidate(credential.transfer_candidates, recipientId);
                const wrapped = await wrapCredentialKey(credential.id, recipientId, candidate?.public_key_fingerprint ?? null);
                return {
                    item_id: credential.id,
                    recipient_id: recipientId,
                    recipient_key_fingerprint: wrapped.fingerprint,
                    encrypted_dek: wrapped.encryptedDek,
                };
            }));
            await apiDelete('/api/v1/users/me', {
                current_password: currentPassword,
                confirmation: typedConfirmation,
                workspace_transfers,
                item_transfers,
            });
            clearCsrfToken();
            useVaultStore.getState().lockVault();
            navigate('/login', { replace: true });
        }
        catch (cause) {
            setError(getErrorMessage(cause));
            setSubmitting(false);
        }
    }
    return (_jsxs("section", { className: "profile-card profile-delete-card", "aria-labelledby": "profile-delete-title", children: [_jsxs("div", { className: "profile-card-heading", children: [_jsx("div", { className: "profile-card-heading__icon profile-delete-icon", children: _jsx(Trash2, { size: 18, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h2", { id: "profile-delete-title", children: "Delete account" }), _jsx("p", { children: "Review what will be removed and transfer any shared ownership first." })] })] }), loading ? (_jsx("p", { className: "profile-muted", role: "status", children: "Preparing your account deletion review\u2026" })) : loadError ? (_jsxs("div", { children: [_jsx("p", { className: "profile-alert", role: "alert", children: loadError }), _jsx("button", { className: "profile-secondary-button", type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Try again" })] })) : preview ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "profile-delete-warning", children: [_jsx(ShieldAlert, { size: 18, "aria-hidden": "true" }), _jsx("p", { children: "Deletion is permanent. Your account credentials, sessions, recovery material, access to shared credentials, personal-only vault entries, and account-owned audit history will be removed. Shared workspaces and credentials with other authorized users will be retained and ownership transferred as selected below." })] }), _jsxs("dl", { className: "profile-delete-summary", children: [_jsxs("div", { children: [_jsx("dt", { children: "Workspaces you belong to" }), _jsx("dd", { children: preview.deletion_scope.workspace_count })] }), _jsxs("div", { children: [_jsx("dt", { children: "Personal credentials to delete" }), _jsx("dd", { children: preview.deletion_scope.personal_credentials_to_delete })] }), _jsxs("div", { children: [_jsx("dt", { children: "Shared credentials to transfer" }), _jsx("dd", { children: preview.deletion_scope.shared_credentials_to_transfer })] }), _jsxs("div", { children: [_jsx("dt", { children: "Shared credentials you can access" }), _jsx("dd", { children: preview.deletion_scope.shared_credentials_you_access })] }), _jsxs("div", { children: [_jsx("dt", { children: "Projects owned by you" }), _jsx("dd", { children: preview.deletion_scope.projects_to_remove_or_transfer })] }), _jsxs("div", { children: [_jsx("dt", { children: "Services owned by you" }), _jsx("dd", { children: preview.deletion_scope.services_to_remove_or_transfer })] }), _jsxs("div", { children: [_jsx("dt", { children: "People to notify by email" }), _jsx("dd", { children: preview.deletion_scope.collaborators_to_notify })] })] }), preview.workspaces.length > 0 && (_jsxs("div", { className: "profile-delete-group", children: [_jsx("h3", { children: "Workspaces" }), preview.workspaces.map((workspace) => (_jsxs("div", { className: "profile-delete-resource", children: [_jsxs("div", { children: [_jsx("strong", { children: workspace.name }), _jsxs("p", { children: ["Your role: ", workspace.role, ".", ' ', workspace.will_be_preserved
                                                        ? `${workspace.remaining_members} other member(s); workspace and shared data will be preserved.`
                                                        : 'No other members or shared credentials; workspace data will be deleted.', !workspace.owned_by_you && workspace.remaining_admins === 0 &&
                                                        ' No other owner or admin remains, so account deletion is blocked until an administrator is added.'] }), workspace.requires_owner_transfer && (_jsx("p", { className: "profile-field-hint", children: "The selected owner will control workspace membership and retained projects and services. Credential access remains governed by each credential\u2019s individual permissions." }))] }), workspace.requires_owner_transfer && (_jsxs("label", { className: "profile-field", children: ["New workspace owner", _jsxs("select", { "aria-label": `New owner for ${workspace.name}`, value: workspaceRecipients[workspace.id] ?? '', onChange: (event) => setWorkspaceRecipients((current) => ({
                                                    ...current,
                                                    [workspace.id]: event.target.value,
                                                })), disabled: submitting, children: [_jsx("option", { value: "", children: "Select an eligible member" }), workspace.transfer_candidates.map((candidate) => (_jsxs("option", { value: candidate.user_id, children: [candidate.email, " (", candidate.role, ")"] }, candidate.user_id)))] }), workspace.transfer_candidates.length === 0 && (_jsx("span", { className: "profile-field-hint", children: "Add a verified member or collaborator before transferring this workspace." }))] }))] }, workspace.id)))] })), preview.owned_credentials.length > 0 && (_jsxs("div", { className: "profile-delete-group", children: [_jsx("h3", { children: "Credentials you own" }), preview.owned_credentials.map((credential) => (_jsxs("div", { className: "profile-delete-resource", children: [_jsxs("div", { children: [_jsx("strong", { children: credential.name }), _jsx("p", { children: credential.will_be_deleted
                                                    ? 'Only you have access; this credential will be permanently deleted.'
                                                    : `Shared with ${credential.shared_with} user(s); the encrypted secret will be preserved and ownership transferred.` })] }), credential.requires_transfer && (_jsxs("label", { className: "profile-field", children: ["New credential owner", _jsxs("select", { "aria-label": `New owner for credential ${credential.name}`, value: itemRecipients[credential.id] ?? '', onChange: (event) => setItemRecipients((current) => ({
                                                    ...current,
                                                    [credential.id]: event.target.value,
                                                })), disabled: submitting, children: [_jsx("option", { value: "", children: "Select a verified user with an encryption key" }), credential.transfer_candidates.map((candidate) => (_jsxs("option", { value: candidate.user_id, children: [candidate.email, " (", candidate.role, ")"] }, candidate.user_id)))] }), credential.transfer_candidates.length === 0 && (_jsx("span", { className: "profile-field-hint", children: "No eligible recipient has a registered encryption key. Add one before deleting this account." }))] }))] }, credential.id)))] })), _jsx("p", { className: "profile-delete-email-note", children: "Vaultnary will queue a notification email to you and each affected collaborator. Emails never contain credential values or encryption keys. Projects and services owned by you in preserved workspaces transfer to the workspace owner; data in workspaces with no remaining collaborators or shared credentials is deleted." }), step === 1 ? (_jsxs("div", { className: "profile-form-actions", children: [_jsx("span", { className: "profile-field-hint", children: "Review the affected data and choose new owners before continuing." }), _jsxs("button", { className: "profile-danger-button", type: "button", disabled: !transfersReady, onClick: () => {
                                    setError('');
                                    setStep(2);
                                }, children: [_jsx(ArrowRightLeft, { size: 15, "aria-hidden": "true" }), "Continue to confirmation"] })] })) : (_jsxs("form", { className: "profile-delete-confirmation", onSubmit: (event) => void handleDelete(event), children: [_jsx("h3", { children: "Final confirmation" }), preview.deletion_scope.shared_credentials_to_transfer > 0 && (_jsx("p", { className: "profile-field-hint", role: "status", children: "Unlock your vault before deleting so shared credential keys can be safely re-wrapped for their new owners in your browser." })), _jsxs("label", { className: "profile-field", children: ["Current password", _jsx("input", { type: "password", autoComplete: "current-password", value: currentPassword, onChange: (event) => setCurrentPassword(event.target.value), disabled: submitting, required: true })] }), _jsxs("label", { className: "profile-field", children: ["Type DELETE to confirm", _jsx("input", { type: "text", autoComplete: "off", value: typedConfirmation, onChange: (event) => setTypedConfirmation(event.target.value), disabled: submitting, required: true })] }), _jsxs("label", { className: "profile-delete-acknowledgement", children: [_jsx("input", { type: "checkbox", checked: acknowledged, onChange: (event) => setAcknowledged(event.target.checked), disabled: submitting }), "I understand that account deletion is permanent and cannot be undone."] }), error && _jsx("p", { className: "profile-alert", role: "alert", children: error }), _jsxs("div", { className: "profile-form-actions", children: [_jsx("button", { className: "profile-secondary-button", type: "button", onClick: () => {
                                            setStep(1);
                                            setError('');
                                        }, disabled: submitting, children: "Back to review" }), _jsxs("button", { className: "profile-danger-button", type: "submit", disabled: submitting ||
                                            !currentPassword ||
                                            typedConfirmation !== 'DELETE' ||
                                            !acknowledged ||
                                            (preview.deletion_scope.shared_credentials_to_transfer > 0 &&
                                                !isVaultUnlocked), children: [_jsx(Trash2, { size: 15, "aria-hidden": "true" }), submitting ? 'Deleting account…' : 'Permanently delete account'] })] })] }))] })) : null] }));
}
