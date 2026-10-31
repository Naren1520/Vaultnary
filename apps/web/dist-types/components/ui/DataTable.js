import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
/**
 * Typed, sortable data table with row selection.
 */
export default function DataTable({ columns, rows, getRowKey, onRowClick, emptyState, selectedKey, caption, }) {
    const [sort, setSort] = useState(null);
    function handleSortClick(col) {
        if (!col.sortable)
            return;
        setSort((prev) => {
            if (prev?.key === col.key) {
                return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key: col.key, direction: 'asc' };
        });
    }
    return (_jsx("div", { style: { overflowX: 'auto', width: '100%' }, children: _jsxs("table", { style: {
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
            }, children: [caption && _jsx("caption", { className: "sr-only", children: caption }), _jsx("thead", { children: _jsx("tr", { style: { borderBottom: 'var(--border-card)' }, children: columns.map((col) => (_jsx("th", { scope: "col", onClick: () => handleSortClick(col), "aria-sort": sort?.key === col.key
                                ? sort.direction === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                : col.sortable
                                    ? 'none'
                                    : undefined, style: {
                                padding: 'var(--space-2) var(--space-3)',
                                textAlign: 'left',
                                fontWeight: 'var(--font-weight-medium)',
                                color: 'var(--color-text-muted)',
                                cursor: col.sortable ? 'pointer' : 'default',
                                userSelect: 'none',
                                width: col.width,
                                whiteSpace: 'nowrap',
                            }, children: _jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }, children: [col.header, col.sortable && (_jsxs("span", { "aria-hidden": "true", style: { display: 'inline-flex', flexDirection: 'column' }, children: [_jsx(ChevronUp, { size: 10, style: {
                                                    color: sort?.key === col.key && sort.direction === 'asc'
                                                        ? 'var(--color-accent)'
                                                        : 'var(--color-border)',
                                                } }), _jsx(ChevronDown, { size: 10, style: {
                                                    color: sort?.key === col.key && sort.direction === 'desc'
                                                        ? 'var(--color-accent)'
                                                        : 'var(--color-border)',
                                                } })] }))] }) }, col.key))) }) }), _jsx("tbody", { children: rows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, style: { padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }, children: emptyState ?? 'No data' }) })) : (rows.map((row) => {
                        const key = getRowKey(row);
                        const isSelected = selectedKey === key;
                        return (_jsx("tr", { onClick: () => onRowClick?.(row), tabIndex: onRowClick ? 0 : undefined, onKeyDown: (e) => {
                                if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    onRowClick(row);
                                }
                            }, "aria-selected": onRowClick ? isSelected : undefined, style: {
                                borderBottom: 'var(--border-card)',
                                cursor: onRowClick ? 'pointer' : 'default',
                                backgroundColor: isSelected ? 'rgba(37,99,235,0.06)' : 'transparent',
                            }, children: columns.map((col) => (_jsx("td", { style: {
                                    padding: 'var(--space-3)',
                                    verticalAlign: 'middle',
                                }, children: col.render(row) }, col.key))) }, key));
                    })) })] }) }));
}
