import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/feedback/EmptyState';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Topbar from '../../components/ui/Topbar';
import { apiGet, apiPost } from '../../services/http-client';
export default function WorkspaceHomePage() {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [workspaceName, setWorkspaceName] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        apiGet('/api/v1/workspaces', { signal: controller.signal })
            .then((response) => {
            setWorkspaces(response.data);
            setError('');
        })
            .catch((cause) => {
            if (!controller.signal.aborted) {
                setError(cause instanceof Error ? cause.message : 'Could not load workspaces.');
            }
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [retryCount]);
    async function handleCreateWorkspace(event) {
        event.preventDefault();
        const name = workspaceName.trim();
        if (!name) {
            setError('Enter a workspace name.');
            return;
        }
        setCreating(true);
        setError('');
        try {
            const response = await apiPost('/api/v1/workspaces', { name });
            navigate(`/app/workspaces/${response.data.id}/projects`);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create workspace.');
        }
        finally {
            setCreating(false);
        }
    }
    const createForm = (_jsxs("form", { onSubmit: handleCreateWorkspace, className: "resource-create-form", children: [_jsx("label", { className: "visually-hidden", htmlFor: "new-workspace-name", children: "Workspace name" }), _jsx("input", { id: "new-workspace-name", value: workspaceName, onChange: (event) => setWorkspaceName(event.target.value), maxLength: 100, placeholder: "Workspace name", required: true, disabled: creating }), _jsxs("button", { type: "submit", disabled: creating || !workspaceName.trim(), children: [_jsx(Plus, { size: 16, "aria-hidden": "true" }), creating ? 'Creating…' : 'Create workspace'] })] }));
    return (_jsxs("div", { className: "app-route-page", children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Workspace', href: '/app/workspaces' }], showSearch: false, actionsSlot: _jsx(Link, { className: "app-secondary-action", to: "/app/workspaces/manage", children: "Manage workspaces" }) }), _jsxs("main", { className: "app-page-content", children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Your organization" }), _jsx("h1", { children: "Workspaces" }), _jsx("p", { children: "Choose a workspace to browse its projects, services, and vaults." })] }), error && (_jsxs("div", { className: "app-request-error", role: "alert", children: [_jsx("p", { children: error }), _jsx("button", { type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Retry" })] })), loading ? (_jsx(SkeletonLoader, { variant: "table-row", rows: 3 })) : workspaces.length === 0 && !error ? (_jsx("section", { className: "resource-empty-panel", children: _jsx(EmptyState, { title: "Create your first workspace", message: "A workspace is the home for your projects, services, vaults, and credentials.", icon: _jsx(Building2, { size: 32 }), action: createForm }) })) : workspaces.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "resource-section-heading", children: [_jsx("h2", { children: "Your workspaces" }), _jsxs("button", { type: "button", className: "app-secondary-action", onClick: () => setShowCreateForm((shown) => !shown), children: [_jsx(Plus, { size: 16, "aria-hidden": "true" }), "New workspace"] })] }), showCreateForm && createForm, _jsx("ul", { className: "resource-card-grid", children: workspaces.map((workspace) => (_jsx("li", { children: _jsxs(Link, { className: "resource-card", to: `/app/workspaces/${workspace.id}/projects`, children: [_jsx("span", { className: "resource-card__icon", children: _jsx(Building2, { size: 20, "aria-hidden": "true" }) }), _jsxs("span", { className: "resource-card__body", children: [_jsx("strong", { children: workspace.name }), _jsxs("span", { children: [workspace.role, " \u00B7 Created ", new Date(workspace.created_at).toLocaleDateString()] })] }), _jsx(ArrowRight, { size: 18, "aria-hidden": "true" })] }) }, workspace.id))) })] })) : null] })] }));
}
