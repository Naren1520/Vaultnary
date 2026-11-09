import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { apiGet, apiPost } from '../../services/http-client';
const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (r) => _jsx("span", { style: { fontWeight: 'var(--font-weight-medium)' }, children: r.name }) },
    { key: 'description', header: 'Description', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.description ?? '-' }) },
    { key: 'created_at', header: 'Created', render: (r) => _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: new Date(r.created_at).toLocaleDateString() }), width: '9rem' },
];
export default function ProjectsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [projects, setProjects] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [workspaceId, setWorkspaceId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const editableWorkspaces = useMemo(() => workspaces.filter(({ role }) => role !== 'viewer'), [workspaces]);
    useEffect(() => {
        const ctrl = new AbortController();
        Promise.all([
            apiGet('/api/v1/projects', { signal: ctrl.signal }),
            apiGet('/api/v1/workspaces', { signal: ctrl.signal }),
        ])
            .then(([projectResponse, workspaceResponse]) => {
            setProjects(projectResponse.data);
            setWorkspaces(workspaceResponse.data);
            setWorkspaceId((current) => current && workspaceResponse.data.some(({ id }) => id === current)
                ? current
                : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '');
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
    }, []);
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
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Projects', href: '/app/projects' }] }), _jsxs("div", { style: { padding: 'var(--space-4)', overflowY: 'auto', flex: 1 }, children: [_jsxs("form", { onSubmit: handleCreate, "aria-label": "Create project", style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }, children: [_jsx("label", { htmlFor: "project-name", style: visuallyHiddenStyle, children: "Project name" }), _jsx("input", { id: "project-name", required: true, maxLength: 100, value: name, onChange: (event) => setName(event.target.value), placeholder: "Project name", style: inputStyle }), _jsx("label", { htmlFor: "project-description", style: visuallyHiddenStyle, children: "Project description" }), _jsx("input", { id: "project-description", maxLength: 500, value: description, onChange: (event) => setDescription(event.target.value), placeholder: "Description (optional)", style: inputStyle }), _jsx("label", { htmlFor: "project-workspace", style: visuallyHiddenStyle, children: "Workspace" }), _jsxs("select", { id: "project-workspace", required: true, value: workspaceId, onChange: (event) => setWorkspaceId(event.target.value), disabled: editableWorkspaces.length === 0, style: inputStyle, children: [editableWorkspaces.length === 0 && _jsx("option", { value: "", children: "No editable workspace" }), editableWorkspaces.map((workspace) => (_jsx("option", { value: workspace.id, children: workspace.name }, workspace.id)))] }), _jsx("button", { type: "submit", disabled: saving || loading || editableWorkspaces.length === 0, style: buttonStyle, children: saving ? 'Creating…' : 'Create project' })] }), error && _jsx("p", { role: "alert", style: { color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }, children: error }), loading
                        ? _jsx(SkeletonLoader, { variant: "table-row", rows: 5 })
                        : _jsx(DataTable, { columns: columns, rows: projects, getRowKey: (r) => r.id, onRowClick: (r) => navigate(`/app/projects/${r.id}`), caption: "Projects", emptyState: _jsx(EmptyState, { title: "No projects", message: "Create a project to start linking credentials." }) })] })] }));
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
