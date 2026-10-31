import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FolderOpen } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', message, action, icon, }) {
    return (_jsxs("div", { role: "status", "aria-label": title, style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
        }, children: [_jsx("span", { "aria-hidden": "true", style: { color: 'var(--color-border)' }, children: icon ?? _jsx(FolderOpen, { size: 32 }) }), _jsx("p", { style: { fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }, children: title }), message && (_jsx("p", { style: { fontSize: 'var(--text-sm)', maxWidth: '20rem' }, children: message })), action && _jsx("div", { children: action })] }));
}
