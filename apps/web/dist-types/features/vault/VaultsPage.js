import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/feedback/EmptyState';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Topbar from '../../components/ui/Topbar';
import { apiGet } from '../../services/http-client';
const columns = [
    { key: 'name', header: 'Vault', sortable: true, render: (vault) => vault.name },
    { key: 'workspace_name', header: 'Workspace', sortable: true, render: (vault) => vault.workspace_name },
    { key: 'project_name', header: 'Project', sortable: true, render: (vault) => vault.project_name },
    { key: 'service_name', header: 'Service', sortable: true, render: (vault) => vault.service_name },
    { key: 'environment', header: 'Environment', sortable: true, render: (vault) => vault.environment },
];
export default function VaultsPage() {
    const navigate = useNavigate();
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        apiGet('/api/v1/vaults', { signal: controller.signal })
            .then((response) => {
            setVaults(response.data);
            setError('');
        })
            .catch((cause) => {
            if (!controller.signal.aborted) {
                setError(cause instanceof Error ? cause.message : 'Could not load service vaults.');
            }
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [retryCount]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Vaults', href: '/app/vault' }] }), _jsxs("div", { className: "app-page-content", style: { flex: 1, overflowY: 'auto' }, children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Services" }), _jsx("h1", { children: "Vaults" }), _jsx("p", { children: "Credentials live in vaults owned by a service." })] }), error && (_jsxs("div", { role: "alert", style: { marginBottom: 'var(--space-4)', color: 'var(--color-danger)' }, children: [_jsx("p", { children: error }), _jsx("button", { type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Retry" })] })), loading ? (_jsx(SkeletonLoader, { variant: "table-row", rows: 4 })) : vaults.length === 0 ? (_jsx(EmptyState, { title: "No service vaults yet", message: "Open a service and create a vault to start adding credentials.", action: _jsx(Link, { to: "/app/projects", children: "Browse projects and services" }) })) : (_jsx(DataTable, { columns: columns, rows: vaults, getRowKey: (vault) => vault.id, onRowClick: (vault) => navigate(`/app/vaults/${vault.id}`), caption: "Service vaults", emptyState: _jsx(EmptyState, { title: "No service vaults" }) }))] })] }));
}
