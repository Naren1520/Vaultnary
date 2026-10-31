import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useState } from 'react';
import Breadcrumbs from './Breadcrumbs';
/* Lazy-load GlobalSearch to keep the Topbar bundle lightweight */
const GlobalSearch = lazy(() => import('../../features/search/GlobalSearch'));
export default function Topbar({ breadcrumbs = [], searchSlot, actionsSlot, showSearch = true, }) {
    const [query, setQuery] = useState('');
    return (_jsxs("header", { style: {
            height: '3rem',
            borderBottom: 'var(--border-card)',
            backgroundColor: 'var(--color-bg)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 var(--space-4)',
            gap: 'var(--space-4)',
            flexShrink: 0,
        }, children: [breadcrumbs.length > 0 && (_jsx("div", { style: { flex: 1, minWidth: 0 }, children: _jsx(Breadcrumbs, { items: breadcrumbs }) })), showSearch && !searchSlot && (_jsx("div", { style: { flexShrink: 0 }, children: _jsx(Suspense, { fallback: _jsx(SearchPlaceholder, {}), children: _jsx(GlobalSearch, { query: query, onQueryChange: setQuery }) }) })), searchSlot && (_jsx("div", { style: { flexShrink: 0 }, children: searchSlot })), actionsSlot && (_jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    flexShrink: 0,
                }, children: actionsSlot }))] }));
}
/** Shown while GlobalSearch lazy-loads */
function SearchPlaceholder() {
    return (_jsx("input", { type: "search", placeholder: "Search vault\u2026", disabled: true, "aria-label": "Search vault", style: {
            width: '16rem',
            padding: 'var(--space-1) var(--space-3)',
            border: 'var(--border-input)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            backgroundColor: 'var(--color-bg-subtle)',
            color: 'var(--color-text)',
            boxSizing: 'border-box',
            opacity: 0.6,
        } }));
}
