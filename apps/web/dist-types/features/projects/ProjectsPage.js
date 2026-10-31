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
    { key: 'description', header: 'Description', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.description ?? '—' }) },
    { key: 'created_at', header: 'Created', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: new Date(r.created_at).toLocaleDateString() }), width: '9rem' },
];
export default function ProjectsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const ctrl = new AbortController();
        apiGet('/api/v1/projects', { signal: ctrl.signal })
            .then((r) => setProjects(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Projects', href: '/app/projects' }] }), _jsx("div", { style: { padding: 'var(--space-4)', overflowY: 'auto', flex: 1 }, children: loading
                    ? _jsx(SkeletonLoader, { variant: "table-row", rows: 5 })
                    : _jsx(DataTable, { columns: columns, rows: projects, getRowKey: (r) => r.id, onRowClick: (r) => navigate(`/app/projects/${r.id}`), caption: "Projects", emptyState: _jsx(EmptyState, { title: "No projects", message: "Create a project to start linking credentials." }) }) })] }));
}
