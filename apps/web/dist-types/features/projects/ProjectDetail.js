import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet } from '../../services/http-client';
export default function ProjectDetail() {
    const { projectId } = useParams();
    const [project, setProject] = useState(null);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        if (!projectId) {
            setError('Project ID is missing.');
            setLoading(false);
            return () => ctrl.abort();
        }
        Promise.all([
            apiGet(`/api/v1/projects/${projectId}`, { signal: ctrl.signal }),
            apiGet('/api/v1/services', { signal: ctrl.signal }),
        ])
            .then(([projectResponse, serviceResponse]) => {
            setProject(projectResponse.data);
            setServices(serviceResponse.data.filter((service) => service.project_id === projectId));
            setError('');
        })
            .catch((cause) => {
            if (!ctrl.signal.aborted) {
                setError(cause instanceof Error ? cause.message : 'Could not load project details.');
            }
        })
            .finally(() => {
            if (!ctrl.signal.aborted)
                setLoading(false);
        });
        return () => ctrl.abort();
    }, [projectId, retryCount]);
    if (loading)
        return _jsx(SkeletonLoader, { variant: "detail-panel" });
    if (!project && !error)
        return _jsx(EmptyState, { title: "Project not found" });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [
                    { label: 'Workspaces', href: '/app/workspaces' },
                    ...(project
                        ? [{
                                label: 'Projects',
                                href: `/app/workspaces/${project.workspace_id}/projects`,
                            }]
                        : []),
                    {
                        label: project?.name ?? 'Project',
                        href: project ? `/app/projects/${project.id}` : '/app/workspaces',
                    },
                ], showSearch: false }), _jsx("div", { style: { padding: 'var(--space-4)' }, children: error ? (_jsxs("div", { role: "alert", style: { color: 'var(--color-danger)' }, children: [_jsx("p", { children: error }), _jsx("button", { type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Retry" })] })) : project && (_jsxs(_Fragment, { children: [_jsx("h1", { style: { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }, children: project.name }), project.description && _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: project.description }), _jsxs("section", { "aria-labelledby": "project-services-heading", style: { marginTop: 'var(--space-6)' }, children: [_jsxs("div", { className: "app-page-heading", children: [_jsx("h2", { id: "project-services-heading", children: "Services" }), _jsx("p", { children: "Services in this project can each contain multiple vaults." })] }), services.length === 0 ? (_jsx(EmptyState, { title: "No services in this project", message: "Create a service here, then add its vaults and credentials.", action: _jsx(Link, { to: `/app/services?project_id=${project.id}`, children: "Create a service" }) })) : (_jsx("ul", { className: "service-vault-list", children: services.map((service) => (_jsx("li", { children: _jsxs(Link, { to: `/app/services/${service.id}`, className: "service-vault-card", children: [_jsx("span", { children: service.name }), _jsx("span", { children: service.environment })] }) }, service.id))) }))] })] })) })] }));
}
