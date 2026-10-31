import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import CredentialBadge from '../../components/ui/CredentialBadge';
import { apiGet } from '../../services/http-client';
import SecretField from './SecretField';
export default function VaultItemDetail() {
    const { itemId } = useParams();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!itemId)
            return;
        let cancelled = false;
        const ctrl = new AbortController();
        setLoading(true);
        apiGet(`/api/v1/vault/items/${itemId}`, { signal: ctrl.signal })
            .then((res) => { if (!cancelled)
            setItem(res.data); })
            .catch(() => { if (!cancelled)
            setItem(null); })
            .finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; ctrl.abort(); };
    }, [itemId]);
    if (loading)
        return _jsx(SkeletonLoader, { variant: "detail-panel" });
    if (!item) {
        return (_jsx("div", { style: { padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: "Item not found or access denied." }));
    }
    return (_jsxs("div", { style: { padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }, children: [_jsx(CredentialBadge, { type: item.credential_type }), _jsx("h2", { style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }, children: item.name })] }), item.inherited_from && (_jsxs("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: ["Inherited access from: ", _jsx("em", { children: item.inherited_from.name })] })), _jsx(SecretField, { itemId: item.id, label: "Secret" }), item.tags.length > 0 && (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }, children: "Tags" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }, children: item.tags.map((tag) => (_jsx("span", { style: { fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', border: 'var(--border-card)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)' }, children: tag }, tag))) })] })), item.notes && (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }, children: "Notes" }), _jsx("p", { style: { fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }, children: item.notes })] })), _jsxs("div", { style: { borderTop: 'var(--border-card)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [item.last_accessed_at && (_jsxs("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: ["Last accessed: ", new Date(item.last_accessed_at).toLocaleString()] })), _jsxs("p", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: ["Created: ", new Date(item.created_at).toLocaleString()] })] })] }));
}
