import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';
/**
 * Recursive tree view with expand/collapse and lazy loading.
 * Shows <SkeletonLoader variant="tree-node"> while children are loading.
 */
export default function TreeView({ nodes, onNodeSelect, onNodeExpand, selectedId, depth = 0, }) {
    return (_jsx("ul", { role: depth === 0 ? 'tree' : 'group', style: { listStyle: 'none', paddingLeft: depth === 0 ? 0 : 'var(--space-4)' }, children: nodes.map((node) => (_jsx(TreeItem, { node: node, onNodeSelect: onNodeSelect, onNodeExpand: onNodeExpand, selectedId: selectedId, depth: depth }, node.id))) }));
}
function TreeItem({ node, onNodeSelect, onNodeExpand, selectedId, depth, }) {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [children, setChildren] = useState(node.children);
    const hasChildren = node.hasChildren || (children && children.length > 0);
    const isSelected = selectedId === node.id;
    async function handleToggle(e) {
        e.stopPropagation();
        if (!hasChildren)
            return;
        if (!expanded && onNodeExpand && !children) {
            setLoading(true);
            try {
                const loaded = await onNodeExpand(node);
                setChildren(loaded);
            }
            finally {
                setLoading(false);
            }
        }
        setExpanded((prev) => !prev);
    }
    function handleSelect() {
        onNodeSelect?.(node);
    }
    return (_jsxs("li", { role: "treeitem", "aria-expanded": hasChildren ? expanded : undefined, "aria-selected": isSelected, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                    color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                    fontSize: 'var(--text-sm)',
                }, onClick: handleSelect, onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect();
                    }
                    if (e.key === 'ArrowRight')
                        handleToggle(e);
                    if (e.key === 'ArrowLeft' && expanded)
                        handleToggle(e);
                }, tabIndex: 0, children: [_jsx("span", { onClick: handleToggle, "aria-label": expanded ? 'Collapse' : 'Expand', style: {
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-text-muted)',
                            visibility: hasChildren ? 'visible' : 'hidden',
                            flexShrink: 0,
                        }, children: expanded ? (_jsx(ChevronDown, { size: 14, "aria-hidden": "true" })) : (_jsx(ChevronRight, { size: 14, "aria-hidden": "true" })) }), node.icon && (_jsx("span", { style: { flexShrink: 0, display: 'flex', alignItems: 'center' }, children: node.icon })), _jsx("span", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: node.label })] }), expanded && (_jsx("div", { children: loading ? (_jsxs("div", { style: { paddingLeft: 'var(--space-4)' }, children: [_jsx(SkeletonLoader, { variant: "tree-node" }), _jsx(SkeletonLoader, { variant: "tree-node" })] })) : children && children.length > 0 ? (_jsx(TreeView, { nodes: children, onNodeSelect: onNodeSelect, onNodeExpand: onNodeExpand, selectedId: selectedId, depth: depth + 1 })) : null }))] }));
}
