import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FolderKey, GitBranch, FolderOpen, Server, ShieldCheck, ScrollText, Users } from 'lucide-react';
const navItems = [
    { label: 'Vault', href: '/app/vault', icon: _jsx(FolderKey, { size: 16, "aria-hidden": "true" }) },
    { label: 'Hierarchy', href: '/app/hierarchy', icon: _jsx(GitBranch, { size: 16, "aria-hidden": "true" }) },
    { label: 'Projects', href: '/app/projects', icon: _jsx(FolderOpen, { size: 16, "aria-hidden": "true" }) },
    { label: 'Services', href: '/app/services', icon: _jsx(Server, { size: 16, "aria-hidden": "true" }) },
    { label: 'Workspaces', href: '/app/workspaces', icon: _jsx(Users, { size: 16, "aria-hidden": "true" }) },
    { label: 'Security', href: '/app/security', icon: _jsx(ShieldCheck, { size: 16, "aria-hidden": "true" }) },
    { label: 'Audit Log', href: '/app/audit', icon: _jsx(ScrollText, { size: 16, "aria-hidden": "true" }) },
];
export default function Sidebar() {
    const location = useLocation();
    return (_jsxs("aside", { "aria-label": "Main navigation", className: "app-sidebar", children: [_jsx("div", { className: "sidebar-brand", children: _jsx(Link, { to: "/app/vault", style: { textDecoration: 'none', display: 'flex', alignItems: 'center' }, children: _jsx(LogoOrText, {}) }) }), _jsx("nav", { "aria-label": "Sidebar navigation", children: _jsx("ul", { className: "sidebar-links", children: navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        return (_jsx("li", { children: _jsxs(Link, { to: item.href, "aria-current": isActive ? 'page' : undefined, className: "sidebar-link", style: {
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                                    color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                                    backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
                                    borderRadius: 'var(--radius-md)',
                                }, children: [item.icon, _jsx("span", { children: item.label })] }) }, item.href));
                    }) }) })] }));
}
/** Shows logo.png if the file exists, otherwise falls back to the text "Vaultnary" */
function LogoOrText() {
    const [imgFailed, setImgFailed] = React.useState(false);
    // logo.png should be placed at src/assets/logo.png
    const logoUrl = new URL('../../assets/logo.png', import.meta.url).href;
    if (!imgFailed) {
        return (_jsx("img", { src: logoUrl, alt: "Vaultnary", onError: () => setImgFailed(true), style: { height: '2rem', width: 'auto', objectFit: 'contain' } }));
    }
    return (_jsx("span", { style: {
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
        }, children: "Vaultnary" }));
}
