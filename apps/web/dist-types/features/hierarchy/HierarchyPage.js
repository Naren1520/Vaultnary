import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/feedback/EmptyState';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Topbar from '../../components/ui/Topbar';
import { apiGet } from '../../services/http-client';
import VaultTree from './VaultTree';
export default function HierarchyPage() {
    const { vaultId } = useParams();
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(!vaultId);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    useEffect(() => {
        if (vaultId)
            return;
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
    }, [retryCount, vaultId]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [
                    { label: 'Vaults', href: '/app/vault' },
                    { label: 'Hierarchy', href: vaultId ? `/app/hierarchy/${vaultId}` : '/app/hierarchy' },
                ] }), _jsxs("div", { className: "app-page-content", style: { flex: 1, overflowY: 'auto' }, children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Optional credential organization" }), _jsx("h1", { children: "Credential hierarchy" }), _jsx("p", { children: "Choose a service vault to browse its credential relationships." })] }), vaultId ? (_jsx(VaultTree, { vaultId: vaultId })) : error ? (_jsxs("div", { role: "alert", style: { color: 'var(--color-danger)' }, children: [_jsx("p", { children: error }), _jsx("button", { type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Retry" })] })) : loading ? (_jsx(SkeletonLoader, { variant: "table-row", rows: 4 })) : vaults.length === 0 ? (_jsx(EmptyState, { title: "No service vaults yet", message: "Create a vault under a service before browsing its credential hierarchy.", action: _jsx(Link, { to: "/app/projects", children: "Browse projects and services" }) })) : (_jsx("ul", { className: "hierarchy-vault-list", children: vaults.map((vault) => (_jsx("li", { children: _jsxs(Link, { to: `/app/hierarchy/${vault.id}`, children: [_jsx("strong", { children: vault.name }), _jsxs("span", { children: [vault.workspace_name, " / ", vault.project_name, " / ", vault.service_name] })] }) }, vault.id))) }))] })] }));
}
