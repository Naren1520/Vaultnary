import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, LockKeyhole, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost } from '../../../services/http-client';
import { importPublicKey } from '../../../crypto/asymmetric';
import { sealItem } from '../../../crypto/envelope';
import { useVaultStore } from '../../../state/vault-store';
import { decodeHex } from '../metadata';
import { MAX_ENV_FILE_BYTES, parseEnv } from './parseEnv';
import { detectCsvFormat, parseCsv } from './parseCsv';
const MAX_ENCRYPTED_ITEM_BYTES = 64 * 1024;
function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}
export default function EnvImportDialog({ onClose, onImported }) {
    const privateKey = useVaultStore((state) => state.privateKey);
    const [source, setSource] = useState('');
    const [format, setFormat] = useState('auto');
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [showValues, setShowValues] = useState(false);
    const fileInput = useRef(null);
    const dialogRef = useRef(null);
    const busyRef = useRef(false);
    const effectiveFormat = useMemo(() => format === 'auto' ? detectCsvFormat(source) ? 'csv' : 'env' : format, [format, source]);
    const parsed = useMemo(() => effectiveFormat === 'csv' ? parseCsv(source) : parseEnv(source), [effectiveFormat, source]);
    const selectedVariables = parsed.variables.filter(({ key }) => selectedKeys.has(key));
    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        function handleKeyDown(event) {
            if (event.key === 'Escape' && !busyRef.current) {
                onClose();
                return;
            }
            if (event.key !== 'Tab')
                return;
            const dialog = dialogRef.current;
            if (!dialog)
                return;
            const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            if (focusable.length === 0)
                return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previousFocus?.focus();
        };
    }, [onClose]);
    function updateSource(value, selectedFormat = format) {
        const detectedFormat = selectedFormat === 'auto'
            ? detectCsvFormat(value) ? 'csv' : 'env'
            : selectedFormat;
        const nextParsed = detectedFormat === 'csv' ? parseCsv(value) : parseEnv(value);
        setSource(value);
        setFormat(selectedFormat);
        setSelectedKeys(new Set(nextParsed.variables.map(({ key }) => key)));
        setError('');
        setShowValues(false);
        setProgress('');
    }
    async function handleFileChange(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file)
            return;
        if (file.size > MAX_ENV_FILE_BYTES) {
            updateSource('', file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'env');
            setError('The selected file exceeds the 1 MB limit.');
            return;
        }
        try {
            const extension = file.name.split('.').pop()?.toLowerCase();
            updateSource(await file.text(), extension === 'csv' ? 'csv' : extension === 'env' ? 'env' : 'auto');
        }
        catch {
            updateSource('', file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'auto');
            setError('Could not read the selected file. Try pasting its contents instead.');
        }
    }
    function toggleVariable(key) {
        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    }
    async function handleImport() {
        if (busyRef.current)
            return;
        setError('');
        if (!privateKey) {
            setError('Unlock the vault before importing environment variables.');
            return;
        }
        if (parsed.issues.length > 0) {
            setError('Fix the environment file issues before importing to avoid silently missing variables.');
            return;
        }
        if (selectedVariables.length === 0) {
            setError('Select at least one variable to import.');
            return;
        }
        busyRef.current = true;
        setBusy(true);
        let failedKey = null;
        try {
            const user = await apiGet('/api/v1/users/me');
            const keyResponse = await apiGet(`/api/v1/auth/public-keys/${encodeURIComponent(user.data.id)}`);
            const publicKey = await importPublicKey(decodeHex(keyResponse.data.public_key));
            const encryptedItems = [];
            for (const [index, variable] of selectedVariables.entries()) {
                setProgress(`Encrypting and importing ${index + 1} of ${selectedVariables.length}…`);
                try {
                    const sealed = await sealItem({ value: variable.value }, {
                        name: variable.key,
                        credential_type: 'custom',
                        tags: ['env'],
                        notes: null,
                        payload_metadata: null,
                    }, publicKey);
                    if (sealed.encryptedPayload.byteLength > MAX_ENCRYPTED_ITEM_BYTES ||
                        sealed.encryptedMetadata.byteLength > MAX_ENCRYPTED_ITEM_BYTES) {
                        throw new Error('The encrypted value exceeds the vault item size limit.');
                    }
                    encryptedItems.push({
                        encrypted_metadata: bytesToBase64(sealed.encryptedMetadata),
                        encrypted_payload: bytesToBase64(sealed.encryptedPayload),
                        encrypted_dek: bytesToBase64(sealed.encryptedDek),
                    });
                }
                catch (cause) {
                    failedKey = variable.key;
                    if (cause instanceof Error)
                        throw cause;
                    throw new Error('Could not encrypt this environment variable.');
                }
            }
            failedKey = null;
            setProgress('Saving all encrypted variables together…');
            const response = await apiPost('/api/v1/vault/import-env', {
                items: encryptedItems,
            });
            if (response.data.imported !== encryptedItems.length) {
                throw new Error('The server returned an unexpected import count. Verify the vault before retrying.');
            }
            onImported(response.data.imported);
            onClose();
        }
        catch (cause) {
            setError(failedKey
                ? `Could not prepare "${failedKey}". Nothing was saved. ${cause instanceof Error ? cause.message : 'Check the value and retry.'}`
                : cause instanceof Error
                    ? `Nothing was imported. ${cause.message}`
                    : 'Nothing was imported. Could not import environment variables.');
            setProgress('');
        }
        finally {
            busyRef.current = false;
            setBusy(false);
        }
    }
    return (_jsx("div", { className: "env-import-overlay", role: "presentation", onMouseDown: (event) => {
            if (event.target === event.currentTarget && !busy)
                onClose();
        }, children: _jsxs("section", { ref: dialogRef, className: "env-import-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "env-import-title", tabIndex: -1, children: [_jsxs("header", { className: "env-import-heading", children: [_jsx("div", { className: "env-import-heading__icon", children: _jsx(LockKeyhole, { size: 19, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Encrypted on this device" }), _jsx("h2", { id: "env-import-title", children: "Import environment variables" }), _jsx("p", { children: "Paste or select a .env or CSV file. Values are encrypted in your browser before they are sent to the server." }), _jsx("p", { children: "Each selected variable becomes its own custom credential, named after the variable." })] })] }), _jsxs("div", { className: "env-import-file-row", children: [_jsx("input", { ref: fileInput, type: "file", accept: ".env,.txt,.csv,text/plain,text/csv", "aria-label": "Choose an environment file", onChange: (event) => { void handleFileChange(event); }, hidden: true }), _jsxs("button", { type: "button", className: "env-import-secondary", onClick: () => fileInput.current?.click(), disabled: busy, children: [_jsx(FileUp, { size: 16, "aria-hidden": "true" }), "Choose file"] }), _jsx("label", { className: "env-import-format-label", htmlFor: "env-import-format", children: "Format" }), _jsxs("select", { id: "env-import-format", value: format, onChange: (event) => {
                                const nextFormat = event.target.value === 'csv' || event.target.value === 'env'
                                    ? event.target.value
                                    : 'auto';
                                setFormat(nextFormat);
                                setError('');
                                setShowValues(false);
                                const nextEffectiveFormat = nextFormat === 'auto'
                                    ? detectCsvFormat(source) ? 'csv' : 'env'
                                    : nextFormat;
                                setSelectedKeys(new Set((nextEffectiveFormat === 'csv' ? parseCsv(source) : parseEnv(source))
                                    .variables.map(({ key }) => key)));
                            }, disabled: busy, children: [_jsx("option", { value: "auto", children: "Auto-detect" }), _jsx("option", { value: "env", children: ".env" }), _jsx("option", { value: "csv", children: "CSV" })] }), _jsx("span", { children: "Maximum 1 MB, up to 100 variables" })] }), _jsx("label", { className: "env-import-label", htmlFor: "env-import-source", children: "Environment file contents" }), _jsx("textarea", { id: "env-import-source", value: source, onChange: (event) => updateSource(event.target.value), placeholder: effectiveFormat === 'csv'
                        ? 'NAME,VALUE\nDATABASE_URL,"postgres://..."\nAPI_KEY,"paste-your-secret"'
                        : 'DATABASE_URL=postgres://...\nAPI_KEY="paste-your-secret"', rows: 7, autoCapitalize: "off", autoCorrect: "off", spellCheck: false, disabled: busy }), parsed.issues.length > 0 && (_jsxs("div", { className: "env-import-issues", role: "alert", children: [_jsx("strong", { children: "Resolve these lines before importing:" }), _jsx("ul", { children: parsed.issues.map((issue, index) => (_jsxs("li", { children: ["Line ", issue.line, ": ", issue.message] }, `${issue.line}-${index}`))) })] })), parsed.variables.length > 0 && parsed.issues.length === 0 && (_jsxs("div", { className: "env-import-preview", children: [_jsxs("div", { className: "env-import-preview__heading", children: [_jsx("strong", { children: "Review variables" }), _jsxs("div", { children: [_jsx("button", { type: "button", className: "env-import-reveal-button", "aria-pressed": showValues, onClick: () => setShowValues((shown) => !shown), disabled: busy, children: showValues ? 'Hide values' : 'Reveal values' }), _jsxs("span", { children: [selectedVariables.length, " of ", parsed.variables.length, " selected"] })] })] }), _jsx("ul", { children: parsed.variables.map(({ key, value }) => (_jsxs("li", { children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: selectedKeys.has(key), onChange: () => toggleVariable(key), disabled: busy }), _jsx("code", { children: key })] }), _jsx("span", { className: "env-import-preview__value", title: `${value.length} characters`, children: value.length === 0 ? 'Empty value' : showValues ? value : '••••••••' })] }, key))) })] })), _jsxs("p", { className: "env-import-security-note", children: [_jsx(ShieldCheck, { size: 16, "aria-hidden": "true" }), "Plaintext values stay in this page and are never included in API requests."] }), (error || progress) && (_jsx("p", { className: error ? 'env-import-error' : 'env-import-status', role: error ? 'alert' : 'status', children: error || progress })), _jsxs("footer", { className: "env-import-actions", children: [_jsx("button", { type: "button", className: "env-import-secondary", onClick: onClose, disabled: busy, children: "Cancel" }), _jsx("button", { type: "button", className: "env-import-primary", onClick: () => { void handleImport(); }, disabled: busy ||
                                parsed.issues.length > 0 ||
                                selectedVariables.length === 0, children: busy ? 'Importing…' : `Encrypt and import ${selectedVariables.length || ''}`.trim() })] })] }) }));
}
