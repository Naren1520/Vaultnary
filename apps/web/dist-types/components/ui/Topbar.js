import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useState } from 'react';
import Breadcrumbs from './Breadcrumbs';
/* Lazy-load GlobalSearch to keep the Topbar bundle lightweight */
const GlobalSearch = lazy(() => import('../../features/search/GlobalSearch'));
export default function Topbar({ breadcrumbs = [], searchSlot, actionsSlot, showSearch = true, }) {
    const [query, setQuery] = useState('');
    return (_jsxs("header", { className: "app-topbar", style: {
            borderBottom: 'var(--border-card)',
            backgroundColor: 'var(--color-bg)',
        }, children: [breadcrumbs.length > 0 && (_jsx("div", { className: "topbar-breadcrumbs", children: _jsx(Breadcrumbs, { items: breadcrumbs }) })), showSearch && !searchSlot && (_jsx("div", { className: "topbar-search", children: _jsx(Suspense, { fallback: _jsx(SearchPlaceholder, {}), children: _jsx(GlobalSearch, { query: query, onQueryChange: setQuery }) }) })), searchSlot && (_jsx("div", { className: "topbar-search", children: searchSlot })), actionsSlot && (_jsx("div", { className: "topbar-actions", children: actionsSlot }))] }));
}
/** Shown while GlobalSearch lazy-loads */
function SearchPlaceholder() {
    return (_jsx("input", { type: "search", placeholder: "Search vault\u2026", disabled: true, "aria-label": "Search vault", style: {
            width: 'min(16rem, 100%)',
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
