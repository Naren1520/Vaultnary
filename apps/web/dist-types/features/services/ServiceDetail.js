import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Topbar from '../../components/ui/Topbar';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet } from '../../services/http-client';
export default function ServiceDetail() {
    const { serviceId } = useParams();
    const [service, setService] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!serviceId)
            return;
        const ctrl = new AbortController();
        apiGet(`/api/v1/services/${serviceId}`, { signal: ctrl.signal })
            .then((r) => setService(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [serviceId]);
    if (loading)
        return _jsx(SkeletonLoader, { variant: "detail-panel" });
    if (!service)
        return _jsx(EmptyState, { title: "Service not found" });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Services', href: '/app/services' }, { label: service.name, href: `/app/services/${service.id}` }] }), _jsxs("div", { style: { padding: 'var(--space-4)' }, children: [_jsx("h1", { style: { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }, children: service.name }), _jsxs("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }, children: ["Environment: ", service.environment] }), service.description && _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: service.description })] })] }));
}
