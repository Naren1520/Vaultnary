import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { deriveKey } from '../../crypto/kdf';
import { generateKekPair } from '../../crypto/asymmetric';
import { unlockVault } from '../../crypto/vault-session';
export default function VaultUnlockScreen({ onUnlocked }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    async function handleUnlock(e) {
        e.preventDefault();
        if (!password)
            return;
        setError('');
        setLoading(true);
        try {
            // Derive master key from password
            const salt = new Uint8Array(16);
            // Use a deterministic salt based on user email for now
            // In production this would be stored server-side
            crypto.getRandomValues(salt);
            const masterKey = await deriveKey(password, salt);
            // Generate or reuse KEK pair (in dev, generate fresh each unlock)
            const kekPair = await generateKekPair();
            // Store in vault-store
            unlockVault(masterKey, kekPair.privateKey);
            onUnlocked();
        }
        catch {
            setError('Failed to unlock vault. Please try again.');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: 'var(--space-4)',
        }, children: _jsxs("div", { style: {
                width: '100%',
                maxWidth: '22rem',
                border: 'var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
                backgroundColor: 'var(--color-bg)',
            }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }, children: [_jsx("div", { style: {
                                width: '3rem',
                                height: '3rem',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-bg-subtle)',
                                border: 'var(--border-card)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, children: _jsx(Lock, { size: 20, style: { color: 'var(--color-text)' }, "aria-hidden": "true" }) }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h1", { style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }, children: "Unlock your vault" }), _jsx("p", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }, children: "Enter your master password to access your credentials" })] })] }), _jsxs("form", { onSubmit: handleUnlock, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("label", { htmlFor: "master-password", style: { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }, children: "Master password" }), _jsx("input", { id: "master-password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoFocus: true, autoComplete: "current-password", placeholder: "Enter master password", style: {
                                        padding: 'var(--space-2) var(--space-3)',
                                        border: 'var(--border-input)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--text-base)',
                                        width: '100%',
                                    }, disabled: loading })] }), error && (_jsx("p", { role: "alert", style: { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }, children: error })), _jsx("button", { type: "submit", disabled: loading || !password, style: {
                                padding: 'var(--space-2) var(--space-4)',
                                backgroundColor: 'var(--color-text)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 'var(--font-weight-medium)',
                                fontSize: 'var(--text-base)',
                                cursor: loading || !password ? 'not-allowed' : 'pointer',
                                opacity: loading || !password ? 0.6 : 1,
                            }, children: loading ? 'Unlocking…' : 'Unlock vault' })] })] }) }));
}
