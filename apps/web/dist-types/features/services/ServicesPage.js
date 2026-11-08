import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { apiGet, apiPost } from '../../services/http-client';
const environments = ['development', 'staging', 'production', 'custom'];
const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (r) => _jsx("span", { style: { fontWeight: 'var(--font-weight-medium)' }, children: r.name }) },
    { key: 'environment', header: 'Environment', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.environment }), width: '8rem' },
    { key: 'description', header: 'Description', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.description ?? '—' }) },
];
export default function ServicesPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [services, setServices] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [projects, setProjects] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [environment, setEnvironment] = useState('development');
    const [workspaceId, setWorkspaceId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const editableWorkspaces = useMemo(() => workspaces.filter(({ role }) => role !== 'viewer'), [workspaces]);
    const workspaceProjects = useMemo(() => projects.filter((project) => project.workspace_id === workspaceId), [projects, workspaceId]);
    useEffect(() => {
        const ctrl = new AbortController();
        Promise.all([
            apiGet('/api/v1/services', { signal: ctrl.signal }),
            apiGet('/api/v1/workspaces', { signal: ctrl.signal }),
            apiGet('/api/v1/projects', { signal: ctrl.signal }),
        ])
            .then(([serviceResponse, workspaceResponse, projectResponse]) => {
            setServices(serviceResponse.data);
            setWorkspaces(workspaceResponse.data);
            setProjects(projectResponse.data);
            setWorkspaceId((current) => current && workspaceResponse.data.some(({ id }) => id === current)
                ? current
                : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '');
        })
            .catch((cause) => {
            if (!ctrl.signal.aborted) {
                setError(cause instanceof Error ? cause.message : 'Could not load services.');
            }
        })
            .finally(() => {
            if (!ctrl.signal.aborted)
                setLoading(false);
        });
        return () => ctrl.abort();
    }, []);
    useEffect(() => {
        if (projectId && !workspaceProjects.some((project) => project.id === projectId)) {
            setProjectId('');
        }
    }, [projectId, workspaceProjects]);
    async function handleCreate(event) {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || !workspaceId) {
            setError(!trimmedName ? 'Enter a service name.' : 'Choose a workspace where you can edit.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await apiPost('/api/v1/services', {
                name: trimmedName,
                description: description.trim() || null,
                environment,
                workspace_id: workspaceId,
                project_id: projectId || null,
            });
            setServices((current) => [response.data, ...current]);
            setName('');
            setDescription('');
            setProjectId('');
            showToast({ message: 'Service created', type: 'success' });
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create service.');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Services', href: '/app/services' }] }), _jsxs("div", { style: { padding: 'var(--space-4)', flex: 1 }, children: [_jsxs("form", { onSubmit: handleCreate, "aria-label": "Create service", style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }, children: [_jsx("label", { htmlFor: "service-name", style: visuallyHiddenStyle, children: "Service name" }), _jsx("input", { id: "service-name", required: true, maxLength: 100, value: name, onChange: (event) => setName(event.target.value), placeholder: "Service name", style: inputStyle }), _jsx("label", { htmlFor: "service-description", style: visuallyHiddenStyle, children: "Service description" }), _jsx("input", { id: "service-description", maxLength: 500, value: description, onChange: (event) => setDescription(event.target.value), placeholder: "Description (optional)", style: inputStyle }), _jsx("label", { htmlFor: "service-environment", style: visuallyHiddenStyle, children: "Environment" }), _jsx("select", { id: "service-environment", value: environment, onChange: (event) => setEnvironment(event.target.value), style: inputStyle, children: environments.map((value) => _jsx("option", { value: value, children: value }, value)) }), _jsx("label", { htmlFor: "service-workspace", style: visuallyHiddenStyle, children: "Workspace" }), _jsxs("select", { id: "service-workspace", required: true, value: workspaceId, onChange: (event) => setWorkspaceId(event.target.value), disabled: editableWorkspaces.length === 0, style: inputStyle, children: [editableWorkspaces.length === 0 && _jsx("option", { value: "", children: "No editable workspace" }), editableWorkspaces.map((workspace) => (_jsx("option", { value: workspace.id, children: workspace.name }, workspace.id)))] }), _jsx("label", { htmlFor: "service-project", style: visuallyHiddenStyle, children: "Project (optional)" }), _jsxs("select", { id: "service-project", value: projectId, onChange: (event) => setProjectId(event.target.value), style: inputStyle, children: [_jsx("option", { value: "", children: "No project" }), workspaceProjects.map((project) => (_jsx("option", { value: project.id, children: project.name }, project.id)))] }), _jsx("button", { type: "submit", disabled: saving || loading || editableWorkspaces.length === 0, style: buttonStyle, children: saving ? 'Creating…' : 'Create service' })] }), error && _jsx("p", { role: "alert", style: { color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }, children: error }), loading
                        ? _jsx(SkeletonLoader, { variant: "table-row", rows: 5 })
                        : _jsx(DataTable, { columns: columns, rows: services, getRowKey: (r) => r.id, onRowClick: (r) => navigate(`/app/services/${r.id}`), caption: "Services", emptyState: _jsx(EmptyState, { title: "No services", message: "Create a service to link credentials to environments." }) })] })] }));
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
