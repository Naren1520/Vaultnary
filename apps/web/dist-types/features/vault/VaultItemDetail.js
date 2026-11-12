import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import CredentialBadge from '../../components/ui/CredentialBadge';
import { apiGet } from '../../services/http-client';
import { useVaultStore } from '../../state/vault-store';
import { decryptVaultMetadata } from './metadata';
import SecretField from './SecretField';
const SECRET_CREDENTIAL_TYPES = new Set([
    'website',
    'database',
    'api_key',
    'token',
    'ssh',
    'totp',
    'recovery_code',
    'custom',
]);
export default function VaultItemDetail() {
    const { itemId } = useParams();
    const privateKey = useVaultStore((state) => state.privateKey);
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!itemId)
            return;
        let cancelled = false;
        const ctrl = new AbortController();
        setLoading(true);
        setError('');
        apiGet(`/api/v1/vault/items/${itemId}`, { signal: ctrl.signal })
            .then(async (res) => {
            if (!privateKey)
                throw new Error('Unlock the vault to view this credential.');
            const metadata = await decryptVaultMetadata(res.data, privateKey);
            if (!cancelled)
                setItem({ ...metadata, inherited_from: res.data.inherited_from });
        })
            .catch((cause) => {
            if (!cancelled) {
                setItem(null);
                setError(cause instanceof Error ? cause.message : 'Could not decrypt credential metadata.');
            }
        })
            .finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; ctrl.abort(); };
    }, [itemId, privateKey]);
    if (loading)
        return _jsx(SkeletonLoader, { variant: "detail-panel" });
    if (!item) {
        return (_jsx("div", { role: "alert", style: { padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: error || 'Item not found or access denied.' }));
    }
    return (_jsxs("div", { style: { padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }, children: [_jsx(CredentialBadge, { type: item.credential_type }), _jsx("h2", { style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }, children: item.name })] }), item.inherited_from && (_jsxs("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: ["Inherited access from: ", _jsx("em", { children: item.inherited_from.name })] })), item.legacy && (_jsx("p", { role: "status", style: { color: 'var(--color-warning, #865d10)', fontSize: 'var(--text-sm)' }, children: "This credential predates encrypted metadata. Its original metadata cannot be recovered automatically; the existing record and any encrypted secret have been preserved." })), item.payload_metadata && Object.entries(item.payload_metadata).map(([key, value]) => (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }), _jsx("p", { style: { fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }, children: typeof value === 'string' ? value : JSON.stringify(value) })] }, key))), SECRET_CREDENTIAL_TYPES.has(item.credential_type) && (_jsx(SecretField, { itemId: item.id, label: "Secret" })), item.tags.length > 0 && (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }, children: "Tags" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }, children: item.tags.map((tag) => (_jsx("span", { style: { fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', border: 'var(--border-card)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)' }, children: tag }, tag))) })] })), item.notes && (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }, children: "Notes" }), _jsx("p", { style: { fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }, children: item.notes })] })), _jsxs("div", { style: { borderTop: 'var(--border-card)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [item.last_accessed_at && (_jsxs("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: ["Last accessed: ", new Date(item.last_accessed_at).toLocaleString()] })), _jsxs("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: ["Created: ", new Date(item.created_at).toLocaleString()] })] })] }));
}
