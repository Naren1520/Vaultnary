import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Mail, Globe, Database, Key, Ticket, Terminal, Bot, Clock, ShieldAlert, Settings2, } from 'lucide-react';
const TYPE_META = {
    email: { label: 'Email', icon: _jsx(Mail, { size: 14, "aria-hidden": "true" }) },
    website: { label: 'Website', icon: _jsx(Globe, { size: 14, "aria-hidden": "true" }) },
    database: { label: 'Database', icon: _jsx(Database, { size: 14, "aria-hidden": "true" }) },
    api_key: { label: 'API Key', icon: _jsx(Key, { size: 14, "aria-hidden": "true" }) },
    token: { label: 'Token', icon: _jsx(Ticket, { size: 14, "aria-hidden": "true" }) },
    ssh: { label: 'SSH', icon: _jsx(Terminal, { size: 14, "aria-hidden": "true" }) },
    service_account: { label: 'Service Account', icon: _jsx(Bot, { size: 14, "aria-hidden": "true" }) },
    totp: { label: 'TOTP', icon: _jsx(Clock, { size: 14, "aria-hidden": "true" }) },
    recovery_code: { label: 'Recovery Code', icon: _jsx(ShieldAlert, { size: 14, "aria-hidden": "true" }) },
    custom: { label: 'Custom', icon: _jsx(Settings2, { size: 14, "aria-hidden": "true" }) },
};
export default function CredentialBadge({ type, showLabel = true, size = 'md', }) {
    const meta = TYPE_META[type] ?? TYPE_META.custom;
    return (_jsxs("span", { "aria-label": meta.label, style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: size === 'sm' ? '2px var(--space-1)' : 'var(--space-1) var(--space-2)',
            border: 'var(--border-card)',
            borderRadius: 'var(--radius-sm)',
            fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            backgroundColor: 'var(--color-bg-subtle)',
            whiteSpace: 'nowrap',
        }, children: [meta.icon, showLabel && meta.label] }));
}
