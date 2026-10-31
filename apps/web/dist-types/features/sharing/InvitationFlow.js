import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { apiGet, apiPost } from '../../services/http-client';
import { isValidEmail } from '../../services/validation';
import { ValidationError, getErrorMessage } from '../../services/error-handler';
import { useVaultStore } from '../../state/vault-store';
import { encryptDek } from '../../crypto/asymmetric';
import { generateDek } from '../../crypto/envelope';
function uint8ToBase64(arr) {
    let bin = '';
    for (let i = 0; i < arr.length; i++)
        bin += String.fromCharCode(arr[i]);
    return btoa(bin);
}
export default function InvitationFlow({ itemId, onSuccess }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('viewer');
    const [submitting, setSubmitting] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [globalError, setGlobalError] = useState('');
    const [success, setSuccess] = useState(false);
    const privateKey = useVaultStore((s) => s.privateKey);
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    async function handleSubmit(e) {
        e.preventDefault();
        setEmailError('');
        setGlobalError('');
        if (!isValidEmail(email)) {
            setEmailError('Enter a valid email address.');
            return;
        }
        setSubmitting(true);
        try {
            let encryptedDek;
            if (isUnlocked && privateKey) {
                try {
                    /* Look up recipient's public key */
                    const recipientRes = await apiGet(`/api/v1/users/lookup?email=${encodeURIComponent(email)}`).catch(() => null);
                    if (recipientRes) {
                        const pkRes = await apiGet(`/api/v1/auth/public-keys/${recipientRes.data.id}`);
                        /* Parse PEM public key */
                        const pem = pkRes.data.public_key;
                        const b64 = pem
                            .replace(/-----BEGIN PUBLIC KEY-----/, '')
                            .replace(/-----END PUBLIC KEY-----/, '')
                            .replace(/\s+/g, '');
                        const bin = atob(b64);
                        const spki = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++)
                            spki[i] = bin.charCodeAt(i);
                        const pubKey = await crypto.subtle.importKey('spki', spki.buffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
                        const dek = await generateDek();
                        const wrapped = await encryptDek(dek, pubKey);
                        encryptedDek = uint8ToBase64(wrapped);
                    }
                }
                catch {
                    /* Proceed without DEK encryption if key fetch fails */
                }
            }
            await apiPost(`/api/v1/vault/items/${itemId}/invitations`, {
                invitee_email: email,
                role,
                encrypted_dek: encryptedDek,
            });
            setSuccess(true);
            onSuccess?.();
        }
        catch (err) {
            if (err instanceof ValidationError) {
                setEmailError(err.fieldErrors.find((fe) => fe.field === 'invitee_email')?.rule ?? '');
                setGlobalError(err.message);
            }
            else {
                setGlobalError(getErrorMessage(err));
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    if (success) {
        return (_jsxs("p", { style: { color: 'var(--color-success)', fontSize: 'var(--text-sm)' }, children: ["Invitation sent to ", email, "."] }));
    }
    return (_jsxs("form", { onSubmit: handleSubmit, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("label", { htmlFor: "invite-email", style: { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }, children: "Recipient email" }), _jsx("input", { id: "invite-email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "colleague@example.com", "aria-invalid": !!emailError, "aria-describedby": emailError ? 'invite-email-error' : undefined, style: { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', width: '100%' }, disabled: submitting }), emailError && (_jsx("span", { id: "invite-email-error", role: "alert", style: { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }, children: emailError }))] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("label", { htmlFor: "invite-role", style: { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }, children: "Role" }), _jsxs("select", { id: "invite-role", value: role, onChange: (e) => setRole(e.target.value), style: { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }, disabled: submitting, children: [_jsx("option", { value: "viewer", children: "Viewer" }), _jsx("option", { value: "editor", children: "Editor" }), _jsx("option", { value: "co_owner", children: "Co-owner" })] })] }), globalError && (_jsx("p", { role: "alert", style: { color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }, children: globalError })), _jsx("button", { type: "submit", disabled: submitting, style: { padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer', alignSelf: 'flex-end' }, children: submitting ? 'Sending…' : 'Send invitation' })] }));
}
