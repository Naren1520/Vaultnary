import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import logoUrl from '../../assets/logo.png';
import './legal.css';
const privacyEmail = 'narensonu1520@gmail.com';
export default function PublicSiteLayout({ children }) {
    const location = useLocation();
    useEffect(() => {
        if (location.hash) {
            document.querySelector(location.hash)?.scrollIntoView();
        }
        else {
            window.scrollTo(0, 0);
        }
    }, [location.pathname, location.hash]);
    return (_jsxs("div", { className: "public-site", children: [_jsx("a", { className: "public-site__skip-link", href: "#public-main", children: "Skip to content" }), _jsx("header", { className: "public-header", children: _jsxs("div", { className: "public-container public-header__inner", children: [_jsx(Link, { to: "/", className: "public-brand", "aria-label": "Vaultnary home", children: _jsx("img", { src: logoUrl, alt: "Vaultnary" }) }), _jsxs("div", { className: "public-header__actions", children: [_jsx(Link, { to: "/login", className: "public-header__login", children: "Log in" }), _jsxs(Link, { to: "/register", className: "public-button public-button--small", children: ["Get started ", _jsx(ArrowRight, { size: 15, "aria-hidden": "true" })] })] })] }) }), _jsx("main", { id: "public-main", children: children }), _jsx("footer", { className: "public-footer", children: _jsxs("div", { className: "public-container", children: [_jsxs("div", { className: "public-footer__top", children: [_jsxs("div", { className: "public-footer__brand", children: [_jsx(Link, { to: "/", className: "public-brand", "aria-label": "Vaultnary home", children: _jsx("img", { src: logoUrl, alt: "Vaultnary" }) }), _jsx("p", { children: "A considered home for the credentials and access your team relies on." })] }), _jsxs("nav", { className: "public-footer__column", "aria-label": "Explore", children: [_jsx("h2", { children: "Explore" }), _jsx(Link, { to: "/#product", children: "Product" }), _jsx(Link, { to: "/#workspaces", children: "Workspaces" }), _jsx(Link, { to: "/security", children: "Security" })] }), _jsxs("nav", { className: "public-footer__column", "aria-label": "Legal and account", children: [_jsx("h2", { children: "Information" }), _jsx(Link, { to: "/privacy", children: "Privacy" }), _jsx(Link, { to: "/terms", children: "Terms" }), _jsx("a", { href: `mailto:${privacyEmail}`, children: "Contact" })] })] }), _jsxs("div", { className: "public-footer__bottom", children: [_jsxs("span", { children: ["\u00A9 ", new Date().getFullYear(), " Vaultnary"] }), _jsx("span", { children: "Thoughtful access management for teams." }), _jsxs(Link, { to: "/register", children: ["Create your workspace ", _jsx(ArrowRight, { size: 14, "aria-hidden": "true" })] })] })] }) })] }));
}
