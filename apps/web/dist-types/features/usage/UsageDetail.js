import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet, apiDelete } from '../../services/http-client';
const columns = [
    {
        key: 'target',
        header: 'Linked to',
        render: (r) => (_jsx("span", { style: { fontSize: 'var(--text-sm)' }, children: r.project_id ? `Project: ${r.project_id}` : r.service_id ? `Service: ${r.service_id}` : '—' })),
    },
    {
        key: 'notes',
        header: 'Notes',
        render: (r) => (_jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: r.notes ?? '—' })),
    },
    {
        key: 'created_at',
        header: 'Added',
        render: (r) => (_jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: new Date(r.created_at).toLocaleDateString() })),
        width: '8rem',
    },
];
export default function UsageDetail({ itemId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const ctrl = new AbortController();
        apiGet(`/api/v1/vault/items/${itemId}/usage`, { signal: ctrl.signal })
            .then((r) => setRecords(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [itemId]);
    async function handleDelete(usageId) {
        await apiDelete(`/api/v1/vault/items/${itemId}/usage/${usageId}`);
        setRecords((prev) => prev.filter((r) => r.id !== usageId));
    }
    const cols = [
        ...columns,
        {
            key: 'actions',
            header: '',
            width: '5rem',
            render: (r) => (_jsx("button", { onClick: () => void handleDelete(r.id), style: {
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px var(--space-2)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                }, children: "Remove" })),
        },
    ];
    if (loading)
        return _jsx(SkeletonLoader, { variant: "table-row", rows: 3 });
    return (_jsx(DataTable, { columns: cols, rows: records, getRowKey: (r) => r.id, caption: "Usage links", emptyState: _jsx(EmptyState, { title: "No usage links", message: "Link this credential to a project or service to track where it is used." }) }));
}
