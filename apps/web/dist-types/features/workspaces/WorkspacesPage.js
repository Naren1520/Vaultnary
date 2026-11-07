import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, Users } from 'lucide-react';
import EmptyState from '../../components/feedback/EmptyState';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import Topbar from '../../components/ui/Topbar';
import { useToast } from '../../components/ui/Toast';
import { apiGet, apiPost, apiPut } from '../../services/http-client';
export default function WorkspacesPage() {
    const { showToast } = useToast();
    const [workspaces, setWorkspaces] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [renamedWorkspaceName, setRenamedWorkspaceName] = useState('');
    const [loading, setLoading] = useState(true);
    const [membersLoading, setMembersLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const loadWorkspaces = useCallback(async (signal) => {
        const response = await apiGet('/api/v1/workspaces', { signal });
        setWorkspaces(response.data);
        setSelectedId((current) => current && response.data.some((workspace) => workspace.id === current)
            ? current
            : response.data[0]?.id ?? null);
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        loadWorkspaces(controller.signal)
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
    }, [loadWorkspaces]);
    useEffect(() => {
        if (!selectedId) {
            setMembers([]);
            setMembersLoading(false);
            return;
        }
        const controller = new AbortController();
        setMembers([]);
        setMembersLoading(true);
        apiGet(`/api/v1/workspaces/${selectedId}/members`, { signal: controller.signal })
            .then((response) => setMembers(response.data))
            .catch((cause) => {
            if (!controller.signal.aborted) {
                setError(cause instanceof Error ? cause.message : 'Could not load workspace members.');
            }
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setMembersLoading(false);
        });
        return () => controller.abort();
    }, [selectedId]);
    async function handleCreate(event) {
        event.preventDefault();
        const workspaceName = newWorkspaceName.trim();
        if (!workspaceName) {
            setError('Enter a workspace name.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await apiPost('/api/v1/workspaces', {
                name: workspaceName,
            });
            await loadWorkspaces();
            setSelectedId(response.data.id);
            setNewWorkspaceName('');
            showToast({ message: 'Workspace created', type: 'success' });
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create workspace.');
        }
        finally {
            setSaving(false);
        }
    }
    async function handleRename(event) {
        event.preventDefault();
        if (!selectedId)
            return;
        const workspaceName = renamedWorkspaceName.trim();
        if (!workspaceName) {
            setError('Enter a workspace name.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await apiPut(`/api/v1/workspaces/${selectedId}`, { name: workspaceName });
            await loadWorkspaces();
            showToast({ message: 'Workspace renamed', type: 'success' });
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not rename workspace.');
        }
        finally {
            setSaving(false);
        }
    }
    const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedId);
    const canManage = selectedWorkspace?.role === 'owner' || selectedWorkspace?.role === 'admin';
    useEffect(() => {
        setRenamedWorkspaceName(selectedWorkspace?.name ?? '');
    }, [selectedWorkspace?.id, selectedWorkspace?.name]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Workspaces', href: '/app/workspaces' }] }), _jsxs("main", { style: {
                    padding: 'var(--space-4)',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 20rem), 1fr))',
                    alignContent: 'start',
                    gap: 'var(--space-4)',
                }, children: [_jsxs("section", { "aria-labelledby": "workspace-list-heading", style: { border: 'var(--border-card)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }, children: [_jsx("h1", { id: "workspace-list-heading", style: { fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }, children: "Your workspaces" }), loading ? (_jsx(SkeletonLoader, { variant: "table-row", rows: 3 })) : error && workspaces.length === 0 ? (_jsx("p", { role: "alert", style: { color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }, children: error })) : workspaces.length === 0 ? (_jsx(EmptyState, { title: "No workspaces", message: "Create a workspace to organize projects and services." })) : (_jsx("ul", { style: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }, children: workspaces.map((workspace) => (_jsx("li", { children: _jsxs("button", { type: "button", "aria-pressed": workspace.id === selectedId, onClick: () => { setSelectedId(workspace.id); setError(''); }, style: {
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-3)',
                                            textAlign: 'left',
                                            padding: 'var(--space-3)',
                                            border: 'var(--border-card)',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: workspace.id === selectedId ? 'var(--color-bg-subtle)' : 'var(--color-bg)',
                                            color: 'var(--color-text)',
                                            cursor: 'pointer',
                                        }, children: [_jsx(Building2, { size: 16, "aria-hidden": "true" }), _jsxs("span", { style: { flex: 1 }, children: [_jsx("strong", { style: { display: 'block', fontSize: 'var(--text-sm)' }, children: workspace.name }), _jsxs("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: [workspace.role, " \u00B7 Created ", new Date(workspace.created_at).toLocaleDateString()] })] })] }) }, workspace.id))) })), _jsxs("form", { onSubmit: handleCreate, style: { marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }, children: [_jsx("label", { htmlFor: "new-workspace-name", style: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }, children: "New workspace name" }), _jsx("input", { id: "new-workspace-name", maxLength: 100, value: newWorkspaceName, onChange: (event) => setNewWorkspaceName(event.target.value), placeholder: "Workspace name", style: { flex: 1, minWidth: 0, padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' } }), _jsxs("button", { type: "submit", disabled: saving, "aria-label": "Create workspace", style: actionButtonStyle, children: [_jsx(Plus, { size: 14, "aria-hidden": "true" }), "Create"] })] })] }), _jsxs("section", { "aria-labelledby": "workspace-details-heading", style: { border: 'var(--border-card)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }, children: [_jsx("h2", { id: "workspace-details-heading", style: { fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }, children: selectedWorkspace?.name ?? 'Workspace details' }), error && workspaces.length > 0 && (_jsx("p", { role: "alert", style: { color: 'var(--color-danger)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }, children: error })), selectedWorkspace && (_jsxs(_Fragment, { children: [canManage && (_jsxs("form", { onSubmit: handleRename, style: { display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }, children: [_jsx("label", { htmlFor: "rename-workspace", style: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }, children: "Rename workspace" }), _jsx("input", { id: "rename-workspace", maxLength: 100, value: renamedWorkspaceName, onChange: (event) => setRenamedWorkspaceName(event.target.value), placeholder: "New workspace name", style: { flex: 1, minWidth: 0, padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' } }), _jsxs("button", { type: "submit", disabled: saving, style: actionButtonStyle, children: [_jsx(RefreshCw, { size: 14, "aria-hidden": "true" }), "Rename"] })] })), _jsxs("h3", { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }, children: [_jsx(Users, { size: 15, "aria-hidden": "true" }), "Members"] }), membersLoading ? (_jsx(SkeletonLoader, { variant: "table-row", rows: 1 })) : members.length === 0 ? (_jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: "No members found." })) : (_jsx("ul", { style: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }, children: members.map((member) => (_jsxs("li", { style: { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: 'var(--border-card)', padding: 'var(--space-2) 0', fontSize: 'var(--text-sm)' }, children: [_jsx("span", { children: member.email }), _jsx("span", { style: { color: 'var(--color-text-muted)' }, children: member.role })] }, member.user_id))) }))] }))] })] })] }));
}
const actionButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
    border: 'var(--border-card)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'var(--color-bg-subtle)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
};
