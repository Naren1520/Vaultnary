import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../services/http-client';
import { sealItem } from '../../crypto/envelope';
import { useVaultStore } from '../../state/vault-store';
import { ValidationError } from '../../services/error-handler';
import Modal from '../ui/Modal';
const TYPE_FIELDS = {
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
};
const ALL_TYPES = [
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
];
const TYPE_LABELS = {
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
};
/* Helpers                                                             */
function importPublicKey(pem) {
    /* Strip PEM header/footer and decode base64 */
    const b64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s+/g, '');
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        buf[i] = bin.charCodeAt(i);
    return crypto.subtle.importKey('spki', buf.buffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
}
function uint8ToBase64(arr) {
    let bin = '';
    for (let i = 0; i < arr.length; i++)
        bin += String.fromCharCode(arr[i]);
    return btoa(bin);
}
/* VaultItemForm                                                        */
export default function VaultItemForm({ itemId, onSuccess }) {
    const isEditMode = Boolean(itemId);
    /* Core form state */
    const [name, setName] = useState('');
    const [credentialType, setCredentialType] = useState('website');
    const [fieldValues, setFieldValues] = useState({});
    const [tagsRaw, setTagsRaw] = useState('');
    const [notes, setNotes] = useState('');
    /* UI state */
    const [submitting, setSubmitting] = useState(false);
    const [loadingItem, setLoadingItem] = useState(isEditMode);
    const [fieldErrors, setFieldErrors] = useState({});
    const [globalError, setGlobalError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    const privateKey = useVaultStore((s) => s.privateKey);
    /* Load existing item in edit mode */
    useEffect(() => {
        if (!itemId)
            return;
        let cancelled = false;
        apiGet(`/api/v1/vault/items/${itemId}`)
            .then((res) => {
            if (cancelled)
                return;
            const item = res.data;
            setName(item.name);
            setCredentialType(item.credential_type);
            setTagsRaw(item.tags.join(', '));
            setNotes(item.notes ?? '');
        })
            .catch(() => {
            if (!cancelled)
                setGlobalError('Failed to load item.');
        })
            .finally(() => {
            if (!cancelled)
                setLoadingItem(false);
        });
        return () => {
            cancelled = true;
        };
    }, [itemId]);
    /* Reset dynamic fields when type changes */
    useEffect(() => {
        setFieldValues({});
    }, [credentialType]);
    function setField(name, value) {
        setFieldValues((prev) => ({ ...prev, [name]: value }));
    }
    function clearError(field) {
        setFieldErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setFieldErrors({});
        setGlobalError('');
        setSubmitting(true);
        try {
            const tags = tagsRaw
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
            /* Build payload_metadata from non-secret fields */
            const fields = TYPE_FIELDS[credentialType];
            const payloadMetadata = {};
            for (const f of fields) {
                if (!f.secret)
                    payloadMetadata[f.name] = fieldValues[f.name] ?? '';
            }
            /* Encrypt secret fields if vault is unlocked */
            let encryptedPayload;
            let encryptedDek;
            const secretFields = fields.filter((f) => f.secret);
            if (secretFields.length > 0 && isUnlocked && privateKey) {
                /* Get our own public key from server to encrypt the DEK */
                try {
                    const meRes = await apiGet('/api/v1/users/me').catch(() => null);
                    /* Fall back: use the in-memory private key's corresponding public key
                       by fetching from /auth/public-keys — we need the user_id.
                       If the endpoint is unavailable, skip encryption gracefully. */
                    if (meRes) {
                        const userId = meRes.data.id;
                        const pkRes = await apiGet(`/api/v1/auth/public-keys/${userId}`);
                        const pubKey = await importPublicKey(pkRes.data.public_key);
                        const secretPayload = {};
                        for (const f of secretFields) {
                            secretPayload[f.name] = fieldValues[f.name] ?? '';
                        }
                        const sealed = await sealItem(secretPayload, pubKey);
                        encryptedPayload = uint8ToBase64(sealed.encryptedPayload);
                        encryptedDek = uint8ToBase64(sealed.encryptedDek);
                    }
                }
                catch {
                    /* Encryption failed — still submit metadata without payload */
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
            };
            let resultId;
            if (isEditMode && itemId) {
                await apiPut(`/api/v1/vault/items/${itemId}`, body);
                resultId = itemId;
            }
            else {
                const res = await apiPost('/api/v1/vault/items', body);
                resultId = res.data.id;
            }
            onSuccess(resultId);
        }
        catch (err) {
            if (err instanceof ValidationError) {
                const errs = {};
                for (const fe of err.fieldErrors) {
                    errs[fe.field] = fe.rule;
                }
                setFieldErrors(errs);
            }
            else {
                setGlobalError(err instanceof Error ? err.message : 'An error occurred.');
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    async function handleDelete() {
        if (!itemId)
            return;
        setSubmitting(true);
        try {
            await apiDelete(`/api/v1/vault/items/${itemId}`, { confirm: true });
            onSuccess('');
        }
        catch (err) {
            setGlobalError(err instanceof Error ? err.message : 'Delete failed.');
        }
        finally {
            setSubmitting(false);
            setShowDeleteModal(false);
        }
    }
    if (loadingItem) {
        return (_jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: "Loading\u2026" }));
    }
    const fields = TYPE_FIELDS[credentialType];
    return (_jsxs(_Fragment, { children: [_jsxs("form", { onSubmit: handleSubmit, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '32rem' }, children: [_jsx("h2", { style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }, children: isEditMode ? 'Edit credential' : 'New credential' }), _jsx(Field, { label: "Name", error: fieldErrors['name'], required: true, children: _jsx("input", { type: "text", value: name, onChange: (e) => { setName(e.target.value); clearError('name'); }, placeholder: "My credential", required: true, style: inputStyle }) }), _jsx(Field, { label: "Type", error: fieldErrors['credential_type'], children: _jsx("select", { value: credentialType, onChange: (e) => setCredentialType(e.target.value), style: inputStyle, children: ALL_TYPES.map((t) => (_jsx("option", { value: t, children: TYPE_LABELS[t] }, t))) }) }), fields.map((f) => (_jsx(Field, { label: f.label, error: fieldErrors[`payload_metadata.${f.name}`] ?? fieldErrors[f.name], children: _jsx("input", { type: f.secret ? 'password' : 'text', value: fieldValues[f.name] ?? '', onChange: (e) => { setField(f.name, e.target.value); clearError(`payload_metadata.${f.name}`); }, autoComplete: f.secret ? 'new-password' : undefined, style: inputStyle }) }, f.name))), _jsx(Field, { label: "Tags", hint: "Comma-separated", error: fieldErrors['tags'], children: _jsx("input", { type: "text", value: tagsRaw, onChange: (e) => { setTagsRaw(e.target.value); clearError('tags'); }, placeholder: "work, api, staging", style: inputStyle }) }), _jsx(Field, { label: "Notes", error: fieldErrors['notes'], children: _jsx("textarea", { value: notes, onChange: (e) => { setNotes(e.target.value); clearError('notes'); }, rows: 3, style: { ...inputStyle, resize: 'vertical', fontFamily: 'inherit' } }) }), globalError && (_jsx("p", { role: "alert", style: { color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }, children: globalError })), _jsxs("div", { style: { display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }, children: [isEditMode && (_jsx("button", { type: "button", onClick: () => setShowDeleteModal(true), disabled: submitting, style: {
                                    padding: 'var(--space-2) var(--space-4)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--text-sm)',
                                    color: '#fff',
                                    backgroundColor: 'var(--color-danger)',
                                    cursor: 'pointer',
                                }, children: "Delete" })), _jsx("button", { type: "submit", disabled: submitting, style: {
                                    padding: 'var(--space-2) var(--space-4)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: 'var(--font-weight-medium)',
                                    color: '#fff',
                                    backgroundColor: 'var(--color-accent)',
                                    cursor: 'pointer',
                                }, children: submitting ? 'Saving…' : isEditMode ? 'Save changes' : 'Create' })] })] }), _jsx(Modal, { open: showDeleteModal, title: "Delete credential", confirmLabel: "Delete", cancelLabel: "Cancel", onConfirm: handleDelete, onClose: () => setShowDeleteModal(false), destructive: true, children: "Are you sure you want to permanently delete this credential? This action cannot be undone." })] }));
}
function Field({ label, hint, error, required, children }) {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsxs("label", { style: {
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text)',
                }, children: [label, required && _jsx("span", { "aria-hidden": "true", style: { color: 'var(--color-danger)' }, children: " *" }), hint && (_jsx("span", { style: { fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'var(--space-1)' }, children: hint }))] }), children, error && (_jsx("p", { role: "alert", style: { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }, children: error }))] }));
}
const inputStyle = {
    padding: 'var(--space-2) var(--space-3)',
    border: 'var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    width: '100%',
    boxSizing: 'border-box',
};
