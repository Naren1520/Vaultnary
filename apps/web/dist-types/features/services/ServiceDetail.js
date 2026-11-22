import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/feedback/EmptyState';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Topbar from '../../components/ui/Topbar';
import { apiGet, apiPost } from '../../services/http-client';
export default function ServiceDetail() {
    const { serviceId } = useParams();
    const [service, setService] = useState(null);
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [createError, setCreateError] = useState('');
    const [vaultName, setVaultName] = useState('');
    const [creating, setCreating] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        if (!serviceId) {
            setLoadError('Service ID is missing.');
            setLoading(false);
            return () => controller.abort();
        }
        Promise.all([
            apiGet(`/api/v1/services/${serviceId}`, { signal: controller.signal }),
            apiGet(`/api/v1/services/${serviceId}/vaults`, {
                signal: controller.signal,
            }),
        ])
            .then(([serviceResponse, vaultResponse]) => {
            setService(serviceResponse.data);
            setVaults(vaultResponse.data);
            setLoadError('');
        })
            .catch((cause) => {
            if (!controller.signal.aborted) {
                setLoadError(cause instanceof Error ? cause.message : 'Could not load service details.');
            }
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [serviceId, retryCount]);
    async function handleCreateVault(event) {
        event.preventDefault();
        if (!serviceId || !service) {
            setCreateError('Service details must be loaded before creating a vault.');
            return;
        }
        const name = vaultName.trim();
        if (!name) {
            setCreateError('Enter a name for the vault.');
            return;
        }
        setCreating(true);
        setCreateError('');
        try {
            const response = await apiPost(`/api/v1/services/${serviceId}/vaults`, { name });
            setVaults((current) => [...current, response.data]);
            setVaultName('');
        }
        catch (cause) {
            setCreateError(cause instanceof Error ? cause.message : 'Could not create the vault.');
        }
        finally {
            setCreating(false);
        }
    }
    if (loading)
        return _jsx(SkeletonLoader, { variant: "detail-panel" });
    if (!service && !loadError)
        return _jsx(EmptyState, { title: "Service not found" });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [
                    { label: 'Projects', href: '/app/projects' },
                    ...(service
                        ? [{ label: 'Project', href: `/app/projects/${service.project_id}` }]
                        : []),
                    { label: service?.name ?? 'Service', href: `/app/services/${serviceId}` },
                ] }), _jsxs("div", { className: "app-page-content", style: { flex: 1, overflowY: 'auto' }, children: [loadError && (_jsxs("div", { role: "alert", style: { marginBottom: 'var(--space-4)', color: 'var(--color-danger)' }, children: [_jsx("p", { children: loadError }), _jsx("button", { type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Retry" })] })), service && (_jsxs(_Fragment, { children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Service" }), _jsx("h1", { children: service.name }), _jsxs("p", { children: ["Environment: ", service.environment] }), service.description && _jsx("p", { children: service.description })] }), _jsxs("section", { "aria-labelledby": "service-vaults-heading", children: [_jsxs("div", { className: "app-page-heading", children: [_jsx("h2", { id: "service-vaults-heading", children: "Vaults" }), _jsx("p", { children: "Credentials created here belong to this service." })] }), vaults.length === 0 ? (_jsx(EmptyState, { title: "No vaults in this service", message: "Create a vault to store this service\u2019s credentials." })) : (_jsx("ul", { className: "service-vault-list", children: vaults.map((vault) => (_jsx("li", { children: _jsxs(Link, { to: `/app/vaults/${vault.id}`, className: "service-vault-card", children: [_jsx("span", { children: vault.name }), _jsx("span", { children: service.environment })] }) }, vault.id))) })), _jsxs("form", { onSubmit: handleCreateVault, className: "service-create-vault", children: [_jsx("label", { htmlFor: "service-vault-name", children: "Create a vault" }), _jsxs("div", { children: [_jsx("input", { id: "service-vault-name", name: "name", type: "text", maxLength: 100, value: vaultName, onChange: (event) => setVaultName(event.target.value), placeholder: "e.g. Production credentials", required: true, disabled: creating }), _jsx("button", { type: "submit", disabled: creating || !vaultName.trim(), children: creating ? 'Creating…' : 'Create vault' })] }), createError && _jsx("p", { role: "alert", children: createError })] })] })] }))] })] }));
}
