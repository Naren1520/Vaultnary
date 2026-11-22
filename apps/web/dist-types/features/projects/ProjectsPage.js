import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FolderOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { apiGet, apiPost } from '../../services/http-client';
export default function ProjectsPage() {
    const { workspaceId: routeWorkspaceId } = useParams();
    const { showToast } = useToast();
    const [projects, setProjects] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [workspaceId, setWorkspaceId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const editableWorkspaces = useMemo(() => workspaces.filter(({ role }) => role !== 'viewer'), [workspaces]);
    const selectedWorkspace = workspaces.find(({ id }) => id === (routeWorkspaceId || workspaceId));
    const canCreateProject = routeWorkspaceId
        ? selectedWorkspace !== undefined && selectedWorkspace.role !== 'viewer'
        : editableWorkspaces.some(({ id }) => id === workspaceId);
    const visibleProjects = routeWorkspaceId
        ? projects.filter((project) => project.workspace_id === routeWorkspaceId)
        : projects;
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError('');
        Promise.all([
            apiGet('/api/v1/projects', { signal: ctrl.signal }),
            apiGet('/api/v1/workspaces', { signal: ctrl.signal }),
        ])
            .then(([projectResponse, workspaceResponse]) => {
            setProjects(projectResponse.data);
            setWorkspaces(workspaceResponse.data);
            if (routeWorkspaceId) {
                setWorkspaceId(routeWorkspaceId);
                setError(workspaceResponse.data.some(({ id }) => id === routeWorkspaceId)
                    ? ''
                    : 'Workspace not found or you do not have access.');
            }
            else {
                setWorkspaceId((current) => current && workspaceResponse.data.some(({ id }) => id === current)
                    ? current
                    : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '');
            }
        })
            .catch((cause) => {
            if (!ctrl.signal.aborted) {
                setError(cause instanceof Error ? cause.message : 'Could not load projects.');
            }
        })
            .finally(() => {
            if (!ctrl.signal.aborted)
                setLoading(false);
        });
        return () => ctrl.abort();
    }, [routeWorkspaceId, retryCount]);
    async function handleCreate(event) {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || !workspaceId) {
            setError(!trimmedName ? 'Enter a project name.' : 'Choose a workspace where you can edit.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await apiPost('/api/v1/projects', {
                name: trimmedName,
                description: description.trim() || null,
                workspace_id: workspaceId,
            });
            setProjects((current) => [response.data, ...current]);
            setName('');
            setDescription('');
            showToast({ message: 'Project created', type: 'success' });
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create project.');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "app-route-page", children: [_jsx(Topbar, { breadcrumbs: [
                    {
                        label: selectedWorkspace?.name ?? 'Workspaces',
                        href: '/app/workspaces',
                    },
                    { label: 'Projects', href: routeWorkspaceId ? `/app/workspaces/${routeWorkspaceId}/projects` : '/app/projects' },
                ], showSearch: false }), _jsxs("main", { className: "app-page-content", children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: selectedWorkspace?.name ?? 'Organize' }), _jsx("h1", { children: "Projects" }), _jsx("p", { children: "Projects organize the services and vaults within this workspace." })] }), _jsxs("form", { onSubmit: handleCreate, "aria-label": "Create project", className: "app-create-form", style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }, children: [_jsx("label", { htmlFor: "project-name", style: visuallyHiddenStyle, children: "Project name" }), _jsx("input", { id: "project-name", required: true, maxLength: 100, value: name, onChange: (event) => setName(event.target.value), placeholder: "Project name", style: inputStyle }), _jsx("label", { htmlFor: "project-description", style: visuallyHiddenStyle, children: "Project description" }), _jsx("input", { id: "project-description", maxLength: 500, value: description, onChange: (event) => setDescription(event.target.value), placeholder: "Description (optional)", style: inputStyle }), !routeWorkspaceId && (_jsxs(_Fragment, { children: [_jsx("label", { htmlFor: "project-workspace", style: visuallyHiddenStyle, children: "Workspace" }), _jsxs("select", { id: "project-workspace", required: true, value: workspaceId, onChange: (event) => setWorkspaceId(event.target.value), disabled: editableWorkspaces.length === 0, style: inputStyle, children: [editableWorkspaces.length === 0 && _jsx("option", { value: "", children: "Create a workspace first" }), editableWorkspaces.map((workspace) => (_jsx("option", { value: workspace.id, children: workspace.name }, workspace.id)))] })] })), _jsx("button", { type: "submit", disabled: saving || loading || !canCreateProject, style: buttonStyle, children: saving ? 'Creating…' : 'Create project' })] }), error && (_jsxs("div", { className: "app-request-error", role: "alert", children: [_jsx("p", { children: error }), _jsx("button", { type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Retry" })] })), loading ? (_jsx(SkeletonLoader, { variant: "table-row", rows: 5 })) : visibleProjects.length === 0 && !error ? (_jsx("section", { className: "resource-empty-panel", children: _jsx(EmptyState, { title: "No projects in this workspace yet", message: "Create a project to organize its services and vaults.", icon: _jsx(FolderOpen, { size: 32 }) }) })) : (_jsx("ul", { className: "resource-card-grid", children: visibleProjects.map((project) => (_jsx("li", { children: _jsxs(Link, { className: "resource-card", to: `/app/projects/${project.id}`, children: [_jsx("span", { className: "resource-card__icon", children: _jsx(FolderOpen, { size: 20, "aria-hidden": "true" }) }), _jsxs("span", { className: "resource-card__body", children: [_jsx("strong", { children: project.name }), _jsx("span", { children: project.description || `Created ${new Date(project.created_at).toLocaleDateString()}` })] }), _jsx(ArrowRight, { size: 18, "aria-hidden": "true" })] }) }, project.id))) }))] })] }));
}
const inputStyle = {
    flex: '1 1 11rem',
    minWidth: 0,
    padding: 'var(--space-2) var(--space-3)',
    border: 'var(--border-input)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
};
const buttonStyle = {
    border: 'var(--border-card)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'var(--color-bg-subtle)',
    color: 'var(--color-text)',
    cursor: 'pointer',
};
const visuallyHiddenStyle = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
};
