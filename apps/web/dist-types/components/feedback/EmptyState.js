import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FolderOpen } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', message, action, icon, }) {
    return (_jsxs("div", { role: "status", "aria-label": title, className: "app-empty-state", style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
        }, children: [_jsx("span", { "aria-hidden": "true", className: "app-empty-state__icon", children: icon ?? _jsx(FolderOpen, { size: 32 }) }), _jsx("p", { className: "app-empty-state__title", style: { fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }, children: title }), message && (_jsx("p", { className: "app-empty-state__message", style: { fontSize: 'var(--text-sm)' }, children: message })), action && _jsx("div", { className: "app-empty-state__action", children: action })] }));
}
