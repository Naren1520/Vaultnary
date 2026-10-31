import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Topbar from '../../components/ui/Topbar';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet } from '../../services/http-client';
const columns = [
    { key: 'action_type', header: 'Action', sortable: true, render: (r) => _jsx("span", { style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }, children: r.action_type }) },
    { key: 'resource_type', header: 'Resource', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.resource_type ?? '—' }), width: '8rem' },
    { key: 'ip_address', header: 'IP', render: (r) => _jsx("span", { style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: r.ip_address ?? '—' }), width: '9rem' },
    { key: 'created_at', header: 'Time', sortable: true, render: (r) => _jsx("span", { style: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }, children: new Date(r.created_at).toLocaleString() }), width: '11rem' },
];
export default function AuditLogPage() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('');
    useEffect(() => {
        const ctrl = new AbortController();
        apiGet('/api/v1/audit/events', { signal: ctrl.signal })
            .then((r) => setEvents(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);
    const filtered = actionFilter
        ? events.filter((e) => e.action_type.includes(actionFilter.toLowerCase()))
        : events;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Audit Log', href: '/app/audit' }] }), _jsxs("div", { style: { padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }, children: [_jsxs("div", { style: { marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }, children: [_jsx("label", { htmlFor: "action-filter", style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }, children: "Filter by action" }), _jsx("input", { id: "action-filter", type: "text", value: actionFilter, onChange: (e) => setActionFilter(e.target.value), placeholder: "e.g. user.login", style: { padding: 'var(--space-1) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', width: '16rem' } })] }), loading
                        ? _jsx(SkeletonLoader, { variant: "table-row", rows: 8 })
                        : _jsx(DataTable, { columns: columns, rows: filtered, getRowKey: (r) => r.id, caption: "Audit events", emptyState: _jsx(EmptyState, { title: "No audit events", message: "Security events will appear here." }) })] })] }));
}
