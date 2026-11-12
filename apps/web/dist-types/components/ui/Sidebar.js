import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FolderKey, GitBranch, FolderOpen, Server, ShieldCheck, ScrollText, Users, CircleUserRound } from 'lucide-react';
const navItems = [
    { label: 'Vault', href: '/app/vault', icon: _jsx(FolderKey, { size: 16, "aria-hidden": "true" }) },
    { label: 'Hierarchy', href: '/app/hierarchy', icon: _jsx(GitBranch, { size: 16, "aria-hidden": "true" }) },
    { label: 'Projects', href: '/app/projects', icon: _jsx(FolderOpen, { size: 16, "aria-hidden": "true" }) },
    { label: 'Services', href: '/app/services', icon: _jsx(Server, { size: 16, "aria-hidden": "true" }) },
    { label: 'Workspaces', href: '/app/workspaces', icon: _jsx(Users, { size: 16, "aria-hidden": "true" }) },
    { label: 'Security', href: '/app/security', icon: _jsx(ShieldCheck, { size: 16, "aria-hidden": "true" }) },
    { label: 'Audit Log', href: '/app/audit', icon: _jsx(ScrollText, { size: 16, "aria-hidden": "true" }) },
    { label: 'Profile', href: '/app/profile', icon: _jsx(CircleUserRound, { size: 16, "aria-hidden": "true" }) },
];
export default function Sidebar() {
    const location = useLocation();
    const navRef = React.useRef(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(false);
    const updateScrollControls = React.useCallback(() => {
        const nav = navRef.current;
        if (!nav)
            return;
        setCanScrollLeft(nav.scrollLeft > 0);
        setCanScrollRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    }, []);
    React.useEffect(() => {
        const nav = navRef.current;
        if (!nav)
            return;
        updateScrollControls();
        nav.addEventListener('scroll', updateScrollControls, { passive: true });
        window.addEventListener('resize', updateScrollControls);
        const observer = new ResizeObserver(updateScrollControls);
        observer.observe(nav);
        return () => {
            nav.removeEventListener('scroll', updateScrollControls);
            window.removeEventListener('resize', updateScrollControls);
            observer.disconnect();
        };
    }, [updateScrollControls]);
    function scrollNavigation(direction) {
        navRef.current?.scrollBy({
            left: direction * Math.max(160, (navRef.current.clientWidth * 0.7)),
            behavior: 'smooth',
        });
    }
    return (_jsxs("aside", { "aria-label": "Main navigation", className: "app-sidebar", children: [_jsx("div", { className: "sidebar-brand", children: _jsx(Link, { to: "/app/vault", style: { textDecoration: 'none', display: 'flex', alignItems: 'center' }, children: _jsx(LogoOrText, {}) }) }), _jsxs("nav", { "aria-label": "Sidebar navigation", children: [_jsx("p", { className: "sidebar-section-label", children: "Workspace" }), _jsxs("div", { className: "sidebar-mobile-nav", children: [_jsx("button", { type: "button", className: "sidebar-scroll-button", "aria-label": "Scroll navigation left", onClick: () => scrollNavigation(-1), disabled: !canScrollLeft, children: _jsx(ChevronLeft, { size: 18, "aria-hidden": "true" }) }), _jsx("ul", { className: "sidebar-links", ref: navRef, children: navItems.map((item) => {
                                    const isActive = location.pathname.startsWith(item.href);
                                    return (_jsx("li", { children: _jsxs(Link, { to: item.href, "aria-current": isActive ? 'page' : undefined, className: "sidebar-link", style: {
                                                fontSize: 'var(--text-sm)',
                                                fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                                                color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                                                backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
                                                borderRadius: 'var(--radius-md)',
                                            }, children: [item.icon, _jsx("span", { children: item.label })] }) }, item.href));
                                }) }), _jsx("button", { type: "button", className: "sidebar-scroll-button", "aria-label": "Scroll navigation right", onClick: () => scrollNavigation(1), disabled: !canScrollRight, children: _jsx(ChevronRight, { size: 18, "aria-hidden": "true" }) })] })] })] }));
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
