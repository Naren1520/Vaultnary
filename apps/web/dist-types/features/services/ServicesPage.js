import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet } from '../../services/http-client';
const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (r) => _jsx("span", { style: { fontWeight: 'var(--font-weight-medium)' }, children: r.name }) },
    { key: 'environment', header: 'Environment', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.environment }), width: '8rem' },
    { key: 'description', header: 'Description', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.description ?? '—' }) },
];
export default function ServicesPage() {
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const ctrl = new AbortController();
        apiGet('/api/v1/services', { signal: ctrl.signal })
            .then((r) => setServices(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Services', href: '/app/services' }] }), _jsx("div", { style: { padding: 'var(--space-4)', flex: 1 }, children: loading
                    ? _jsx(SkeletonLoader, { variant: "table-row", rows: 5 })
                    : _jsx(DataTable, { columns: columns, rows: services, getRowKey: (r) => r.id, onRowClick: (r) => navigate(`/app/services/${r.id}`), caption: "Services", emptyState: _jsx(EmptyState, { title: "No services", message: "Create a service to link credentials to environments." }) }) })] }));
}
