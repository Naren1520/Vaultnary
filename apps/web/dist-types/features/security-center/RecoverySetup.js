import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/feedback/EmptyState';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { apiGet, apiPost } from '../../services/http-client';
import { deriveKey } from '../../crypto/kdf';
import { encrypt } from '../../crypto/symmetric';
import { useVaultStore } from '../../state/vault-store';
function uint8ToHex(arr) {
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export default function RecoverySetup() {
    const [configured, setConfigured] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [passphraseConfirm, setPassphraseConfirm] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const privateKey = useVaultStore((s) => s.privateKey);
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    useEffect(() => {
        apiGet('/api/v1/recovery/setup')
            .then((r) => setConfigured(r.data.configured))
            .catch(() => setConfigured(false))
            .finally(() => setLoading(false));
    }, []);
    async function handleSetup() {
        setError('');
        if (passphrase.length < 12) {
            setError('Recovery passphrase must be at least 12 characters.');
            return;
        }
        if (passphrase !== passphraseConfirm) {
            setError('Passphrases do not match.');
            return;
        }
        if (!isUnlocked || !privateKey) {
            setError('Vault must be unlocked to set up recovery.');
            return;
        }
        setSaving(true);
        try {
            /* Export private key to raw bytes */
            let privateKeyBytes;
            try {
                privateKeyBytes = await crypto.subtle.exportKey('pkcs8', privateKey);
            }
            catch {
                setError('Cannot export private key -it may not be extractable.');
                return;
            }
            /* Derive key from recovery passphrase */
            const salt = new Uint8Array(16);
            crypto.getRandomValues(salt);
            const recoveryKey = await deriveKey(passphrase, salt);
            /* Encrypt private key with recovery key */
            const plaintext = new Uint8Array(privateKeyBytes);
            const ciphertext = await encrypt(recoveryKey, plaintext);
            /* Compute integrity tag (first 16 bytes of ciphertext = auth tag in AES-GCM) */
            const integrityTag = ciphertext.slice(ciphertext.length - 16);
            const kdfParams = {
                algorithm: 'argon2id',
                memory_cost: 65536,
                time_cost: 3,
                parallelism: 4,
                salt: uint8ToHex(salt),
            };
            await apiPost('/api/v1/recovery/setup', {
                encrypted_private_key: uint8ToHex(ciphertext),
                integrity_tag: uint8ToHex(integrityTag),
                kdf_params: kdfParams,
            });
            setConfigured(true);
            setSuccess(true);
            setModalOpen(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Recovery setup failed.');
        }
        finally {
            setSaving(false);
        }
    }
    if (loading)
        return _jsx(SkeletonLoader, { variant: "line" });
    if (success || configured) {
        return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }, children: [_jsx("span", { style: { color: 'var(--color-success)', fontSize: 'var(--text-sm)' }, children: "Recovery configured" }), _jsx("button", { onClick: () => { setSuccess(false); setModalOpen(true); }, style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }, children: "Update" })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(EmptyState, { title: "Recovery not configured", message: "If you lose access to your vault, a recovery passphrase lets you restore your private key. Set it up now.", action: _jsx("button", { onClick: () => setModalOpen(true), style: { padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer' }, children: "Set up recovery" }) }), _jsx(Modal, { open: modalOpen, title: "Set up recovery passphrase", confirmLabel: "Save recovery key", onConfirm: () => void handleSetup(), onClose: () => setModalOpen(false), children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }, children: [_jsx("p", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }, children: "Choose a strong passphrase (12+ characters). Store it somewhere safe -you will need it to recover your vault if you lose access." }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("label", { htmlFor: "recovery-passphrase", style: { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }, children: "Recovery passphrase" }), _jsx("input", { id: "recovery-passphrase", type: "password", value: passphrase, onChange: (e) => setPassphrase(e.target.value), autoComplete: "new-password", disabled: saving, style: { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' } })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("label", { htmlFor: "recovery-passphrase-confirm", style: { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }, children: "Confirm passphrase" }), _jsx("input", { id: "recovery-passphrase-confirm", type: "password", value: passphraseConfirm, onChange: (e) => setPassphraseConfirm(e.target.value), autoComplete: "new-password", disabled: saving, style: { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' } })] }), error && (_jsx("p", { role: "alert", style: { color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }, children: error }))] }) })] }));
}
