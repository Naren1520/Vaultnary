import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Breadcrumbs from './Breadcrumbs';
export default function Topbar({ breadcrumbs = [], searchSlot, actionsSlot }) {
    return (_jsxs("header", { style: {
            height: '3rem',
            borderBottom: 'var(--border-card)',
            backgroundColor: 'var(--color-bg)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 var(--space-4)',
            gap: 'var(--space-4)',
            flexShrink: 0,
        }, children: [breadcrumbs.length > 0 && (_jsx("div", { style: { flex: 1, minWidth: 0 }, children: _jsx(Breadcrumbs, { items: breadcrumbs }) })), searchSlot && (_jsx("div", { style: { flexShrink: 0 }, children: searchSlot })), actionsSlot && (_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }, children: actionsSlot }))] }));
}
