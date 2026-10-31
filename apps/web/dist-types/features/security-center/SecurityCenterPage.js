import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Topbar from '../../components/ui/Topbar';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet, apiDelete } from '../../services/http-client';
export default function SecurityCenterPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const ctrl = new AbortController();
        apiGet('/api/v1/security/sessions', { signal: ctrl.signal })
            .then((r) => setSessions(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);
    async function revokeSession(id) {
        await apiDelete(`/api/v1/auth/sessions/${id}`);
        setSessions((prev) => prev.filter((s) => s.id !== id));
    }
    const columns = [
        { key: 'ip_address', header: 'IP Address', render: (r) => _jsx("span", { style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }, children: r.ip_address ?? '—' }) },
        { key: 'user_agent', header: 'Device', render: (r) => _jsx("span", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }, children: r.user_agent ?? '—' }) },
        { key: 'created_at', header: 'Created', sortable: true, render: (r) => _jsx("span", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: new Date(r.created_at).toLocaleString() }), width: '10rem' },
        { key: 'last_used_at', header: 'Last used', render: (r) => _jsx("span", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: r.last_used_at ? new Date(r.last_used_at).toLocaleString() : '—' }), width: '10rem' },
        {
            key: 'actions', header: '', width: '6rem',
            render: (r) => (_jsx("button", { onClick: (e) => { e.stopPropagation(); void revokeSession(r.id); }, style: { fontSize: 'var(--text-xs)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', padding: '2px var(--space-2)', backgroundColor: 'transparent', cursor: 'pointer' }, children: "Revoke" })),
        },
    ];
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Security Center', href: '/app/security' }] }), _jsxs("div", { style: { padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }, children: [_jsx("h2", { style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }, children: "Active Sessions" }), loading
                        ? _jsx(SkeletonLoader, { variant: "table-row", rows: 4 })
                        : _jsx(DataTable, { columns: columns, rows: sessions, getRowKey: (r) => r.id, caption: "Active sessions", emptyState: _jsx(EmptyState, { title: "No active sessions" }) })] })] }));
}
