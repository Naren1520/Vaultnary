import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TreeView from '../../components/ui/TreeView';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/feedback/EmptyState';
import { apiGet } from '../../services/http-client';
function mapToTreeNode(item) {
    return {
        id: item.id,
        label: item.name,
        hasChildren: item.has_children,
        children: item.children?.map(mapToTreeNode),
    };
}
export default function VaultTree() {
    const navigate = useNavigate();
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const ctrl = new AbortController();
        apiGet('/api/v1/vault/tree?depth=2', { signal: ctrl.signal })
            .then((res) => setNodes(res.data.map(mapToTreeNode)))
            .catch(() => { })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, []);
    async function handleExpand(node) {
        const res = await apiGet(`/api/v1/vault/items/${node.id}/children`);
        return res.data.map(mapToTreeNode);
    }
    if (loading) {
        return (_jsx("div", { children: Array.from({ length: 5 }).map((_, i) => (_jsx(SkeletonLoader, { variant: "tree-node" }, i))) }));
    }
    if (nodes.length === 0) {
        return _jsx(EmptyState, { title: "No credentials yet", message: "Create credentials to see the hierarchy." });
    }
    return (_jsx(TreeView, { nodes: nodes, onNodeSelect: (node) => navigate(`/app/vault/${node.id}`), onNodeExpand: handleExpand }));
}
