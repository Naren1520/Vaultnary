import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
export default function Breadcrumbs({ items }) {
    return (_jsx("nav", { "aria-label": "Breadcrumb", children: _jsx("ol", { style: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-1)',
                listStyle: 'none',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
            }, children: items.map((item, index) => {
                const isLast = index === items.length - 1;
                return (_jsxs("li", { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }, children: [index > 0 && (_jsx("span", { "aria-hidden": "true", style: { color: 'var(--color-border)' }, children: "/" })), isLast ? (_jsx("span", { "aria-current": "page", style: { color: 'var(--color-text)', fontWeight: 'var(--font-weight-medium)' }, children: item.label })) : (_jsx(Link, { to: item.href, style: {
                                color: 'var(--color-text-muted)',
                                textDecoration: 'none',
                            }, onMouseEnter: (e) => {
                                ;
                                e.currentTarget.style.color =
                                    'var(--color-accent)';
                            }, onMouseLeave: (e) => {
                                ;
                                e.currentTarget.style.color =
                                    'var(--color-text-muted)';
                            }, children: item.label }))] }, item.href));
            }) }) }));
}
