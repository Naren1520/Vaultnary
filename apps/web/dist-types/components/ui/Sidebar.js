import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, FolderKey, GitBranch, FolderOpen, Server, ScrollText, Lock, } from 'lucide-react';
const navItems = [
    { label: 'Vault', href: '/app/vault', icon: _jsx(FolderKey, { size: 16, "aria-hidden": "true" }) },
    { label: 'Hierarchy', href: '/app/hierarchy', icon: _jsx(GitBranch, { size: 16, "aria-hidden": "true" }) },
    { label: 'Projects', href: '/app/projects', icon: _jsx(FolderOpen, { size: 16, "aria-hidden": "true" }) },
    { label: 'Services', href: '/app/services', icon: _jsx(Server, { size: 16, "aria-hidden": "true" }) },
    { label: 'Security', href: '/app/security', icon: _jsx(ShieldCheck, { size: 16, "aria-hidden": "true" }) },
    { label: 'Audit Log', href: '/app/audit', icon: _jsx(ScrollText, { size: 16, "aria-hidden": "true" }) },
];
export default function Sidebar() {
    const location = useLocation();
    return (_jsxs("aside", { "aria-label": "Main navigation", style: {
            width: 'var(--sidebar-width)',
            minHeight: '100vh',
            borderRight: 'var(--border-card)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--space-4) 0',
            flexShrink: 0,
        }, children: [_jsxs("div", { style: {
                    padding: '0 var(--space-4)',
                    marginBottom: 'var(--space-6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                }, children: [_jsx(Lock, { size: 18, "aria-hidden": "true", style: { color: 'var(--color-accent)' } }), _jsx("span", { style: {
                            fontWeight: 'var(--font-weight-semibold)',
                            fontSize: 'var(--text-base)',
                            color: 'var(--color-text)',
                        }, children: "Vaultnary" })] }), _jsx("nav", { "aria-label": "Sidebar navigation", children: _jsx("ul", { style: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        return (_jsx("li", { children: _jsxs(Link, { to: item.href, "aria-current": isActive ? 'page' : undefined, style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-2) var(--space-4)',
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                                    color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                                    backgroundColor: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                                    borderRadius: 'var(--radius-md)',
                                    margin: '0 var(--space-2)',
                                    textDecoration: 'none',
                                    transition: 'background-color 0.1s',
                                }, children: [item.icon, item.label] }) }, item.href));
                    }) }) })] }));
}
