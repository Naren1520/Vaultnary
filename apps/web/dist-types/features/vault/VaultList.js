import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import CredentialBadge from '../../components/ui/CredentialBadge';
import { apiGet } from '../../services/http-client';
const columns = [
    {
        key: 'name',
        header: 'Name',
        sortable: true,
        render: (row) => _jsx("span", { style: { fontWeight: 'var(--font-weight-medium)' }, children: row.name }),
    },
    {
        key: 'credential_type',
        header: 'Type',
        render: (row) => _jsx(CredentialBadge, { type: row.credential_type, size: "sm" }),
        width: '10rem',
    },
    {
        key: 'tags',
        header: 'Tags',
        render: (row) => (_jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: row.tags.join(', ') })),
    },
    {
        key: 'last_accessed_at',
        header: 'Last accessed',
        sortable: true,
        render: (row) => row.last_accessed_at ? (_jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: new Date(row.last_accessed_at).toLocaleDateString() })) : (_jsx("span", { style: { color: 'var(--color-border)' }, children: "\u2014" })),
        width: '9rem',
    },
];
export default function VaultList() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        const ctrl = new AbortController();
        apiGet('/api/v1/vault/items?limit=20', { signal: ctrl.signal })
            .then((res) => { if (!cancelled)
            setItems(res.data); })
            .catch((err) => { if (!cancelled)
            setError(String(err)); })
            .finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; ctrl.abort(); };
    }, []);
    if (loading)
        return _jsx(SkeletonLoader, { variant: "table-row", rows: 6 });
    if (error)
        return _jsx("p", { style: { color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }, children: error });
    return (_jsx(DataTable, { columns: columns, rows: items, getRowKey: (r) => r.id, onRowClick: (r) => navigate(`/app/vault/${r.id}`), caption: "Vault credentials", emptyState: _jsx(EmptyState, { title: "Your vault is empty", message: "Add your first credential to get started." }) }));
}
