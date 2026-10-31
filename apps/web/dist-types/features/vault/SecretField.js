import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useVaultStore } from '../../state/vault-store';
import { openItem } from '../../crypto/envelope';
import { apiGet } from '../../services/http-client';
const MASK_TIMEOUT_MS = 30_000;
const CLIPBOARD_CLEAR_MS = 30_000;
const COPY_TOAST_MS = 3_000;
/**
 * Masked secret field.
 * - When the vault is unlocked and no pre-decrypted value is given, fetches
 *   the encrypted payload and DEK from the server and decrypts them in-browser
 *   using the private key stored in vault-store.
 * - Reveal toggle: decrypts and shows value for 30 s, then re-masks.
 * - Copy: writes to clipboard, clears after 30 s, shows toast for 3 s.
 * - Never writes plaintext to localStorage, sessionStorage, or any URL.
 */
export default function SecretField({ itemId, label, value: preloadedValue }) {
    const { showToast } = useToast();
    const privateKey = useVaultStore((s) => s.privateKey);
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    const [decryptedValue, setDecryptedValue] = useState(preloadedValue);
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [decrypting, setDecrypting] = useState(false);
    const maskTimer = useRef(null);
    const clipboardTimer = useRef(null);
    /* When itemId or preloadedValue changes, reset decrypted state */
    useEffect(() => {
        setDecryptedValue(preloadedValue);
        setRevealed(false);
        clearMaskTimer();
    }, [itemId, preloadedValue]);
    function clearMaskTimer() {
        if (maskTimer.current) {
            clearTimeout(maskTimer.current);
            maskTimer.current = null;
        }
    }
    function scheduleMask() {
        clearMaskTimer();
        maskTimer.current = setTimeout(() => setRevealed(false), MASK_TIMEOUT_MS);
    }
    /** Fetch encrypted payload + DEK then decrypt using the vault private key */
    async function fetchAndDecrypt() {
        if (!isUnlocked || !privateKey)
            return undefined;
        try {
            setDecrypting(true);
            const res = await apiGet(`/api/v1/vault/items/${itemId}/key-envelope`);
            const { encrypted_payload, encrypted_dek } = res.data;
            /* Convert hex/base64 strings to Uint8Array */
            const payloadBytes = hexOrBase64ToBytes(encrypted_payload);
            const dekBytes = hexOrBase64ToBytes(encrypted_dek);
            const secret = await openItem(payloadBytes, dekBytes, privateKey);
            /* The secret is an object — return a readable representation */
            return JSON.stringify(secret, null, 2);
        }
        catch {
            showToast({ message: 'Could not decrypt secret', type: 'error' });
            return undefined;
        }
        finally {
            setDecrypting(false);
        }
    }
    async function handleReveal() {
        if (revealed) {
            clearMaskTimer();
            setRevealed(false);
            return;
        }
        /* Use pre-loaded or already-decrypted value if available */
        let val = decryptedValue;
        if (!val && isUnlocked) {
            val = await fetchAndDecrypt();
            if (val)
                setDecryptedValue(val);
        }
        if (val) {
            setRevealed(true);
            scheduleMask();
        }
        else if (!isUnlocked) {
            showToast({ message: 'Unlock your vault to reveal secrets', type: 'info' });
        }
    }
    const handleCopy = useCallback(async () => {
        const val = decryptedValue;
        if (!val) {
            if (isUnlocked) {
                const fetched = await fetchAndDecrypt();
                if (fetched) {
                    setDecryptedValue(fetched);
                    await writeToClipboard(fetched);
                }
            }
            else {
                showToast({ message: 'Unlock your vault to copy secrets', type: 'info' });
            }
            return;
        }
        await writeToClipboard(val);
    }, [decryptedValue, isUnlocked, privateKey, itemId]);
    async function writeToClipboard(val) {
        try {
            await navigator.clipboard.writeText(val);
            setCopied(true);
            showToast({ message: 'Copied to clipboard', type: 'success', duration: COPY_TOAST_MS });
            if (clipboardTimer.current)
                clearTimeout(clipboardTimer.current);
            clipboardTimer.current = setTimeout(async () => {
                try {
                    await navigator.clipboard.writeText('');
                }
                catch {
                    /* ignore */
                }
            }, CLIPBOARD_CLEAR_MS);
            setTimeout(() => setCopied(false), COPY_TOAST_MS);
        }
        catch {
            showToast({ message: 'Could not access clipboard', type: 'error' });
        }
    }
    /* Cleanup timers on unmount */
    useEffect(() => () => {
        clearMaskTimer();
        if (clipboardTimer.current)
            clearTimeout(clipboardTimer.current);
    }, []);
    const displayValue = revealed && decryptedValue ? decryptedValue : '••••••••••••';
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: label }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    border: 'var(--border-input)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-sm)',
                }, children: [_jsx("span", { "aria-live": "polite", "aria-label": revealed ? `${label} revealed` : `${label} hidden`, style: {
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }, children: decrypting ? 'Decrypting…' : displayValue }), _jsx("button", { onClick: handleReveal, disabled: decrypting, "aria-label": revealed ? `Hide ${label}` : `Reveal ${label}`, "aria-pressed": revealed, style: {
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                        }, children: revealed ? (_jsx(EyeOff, { size: 14, "aria-hidden": "true" })) : (_jsx(Eye, { size: 14, "aria-hidden": "true" })) }), _jsx("button", { onClick: handleCopy, disabled: decrypting, "aria-label": `Copy ${label} to clipboard`, style: {
                            color: copied ? 'var(--color-success)' : 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                        }, children: copied ? (_jsx(Check, { size: 14, "aria-hidden": "true" })) : (_jsx(Copy, { size: 14, "aria-hidden": "true" })) })] })] }));
}
/* Attempt to decode a hex string; fall back to base64 */
function hexOrBase64ToBytes(s) {
    /* Hex: even length, all hex chars */
    if (s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)) {
        const buf = new Uint8Array(s.length / 2);
        for (let i = 0; i < s.length; i += 2) {
            buf[i / 2] = parseInt(s.slice(i, i + 2), 16);
        }
        return buf;
    }
    /* Base64 */
    const bin = atob(s);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        buf[i] = bin.charCodeAt(i);
    }
    return buf;
}
