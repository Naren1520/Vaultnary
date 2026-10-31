import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet } from '../../services/http-client';
export default function ProjectDetail() {
    const { projectId } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!projectId)
            return;
        const ctrl = new AbortController();
        apiGet(`/api/v1/projects/${projectId}`, { signal: ctrl.signal })
            .then((r) => setProject(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [projectId]);
    if (loading)
        return _jsx(SkeletonLoader, { variant: "detail-panel" });
    if (!project)
        return _jsx(EmptyState, { title: "Project not found" });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Projects', href: '/app/projects' }, { label: project.name, href: `/app/projects/${project.id}` }] }), _jsxs("div", { style: { padding: 'var(--space-4)' }, children: [_jsx("h1", { style: { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }, children: project.name }), project.description && _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: project.description })] })] }));
}
