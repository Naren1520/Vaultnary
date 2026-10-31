import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
const pulseStyle = {
    backgroundColor: 'var(--color-bg-subtle)',
    borderRadius: 'var(--radius-sm)',
    animation: 'skeleton-pulse 1.4s ease-in-out infinite',
};
/**
 * CSS-only skeleton loader. All animation uses @keyframes — no JS animation.
 * The global keyframe is injected once via a <style> tag in the DOM.
 */
export default function SkeletonLoader({ variant, rows = 3, className, }) {
    return (_jsxs(_Fragment, { children: [_jsx(SkeletonKeyframes, {}), _jsx(SkeletonShape, { variant: variant, rows: rows, className: className })] }));
}
function SkeletonKeyframes() {
    return (_jsx("style", { children: `
      @keyframes skeleton-pulse {
        0%   { opacity: 1; }
        50%  { opacity: 0.4; }
        100% { opacity: 1; }
      }
    ` }));
}
function SkeletonShape({ variant, rows, className, }) {
    const base = { ...pulseStyle };
    switch (variant) {
        case 'line':
            return (_jsx("div", { role: "status", "aria-label": "Loading", className: className, style: { ...base, height: '1rem', width: '60%' } }));
        case 'multiline':
            return (_jsx("div", { role: "status", "aria-label": "Loading", className: className, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }, children: Array.from({ length: rows }).map((_, i) => (_jsx("div", { style: { ...base, height: '1rem', width: i === rows - 1 ? '40%' : '100%' } }, i))) }));
        case 'table-row':
            return (_jsx("div", { role: "status", "aria-label": "Loading", className: className, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }, children: Array.from({ length: rows }).map((_, i) => (_jsxs("div", { style: {
                        display: 'flex',
                        gap: 'var(--space-4)',
                        alignItems: 'center',
                        padding: 'var(--space-3) 0',
                        borderBottom: 'var(--border-card)',
                    }, children: [_jsx("div", { style: { ...base, height: '1rem', width: '30%' } }), _jsx("div", { style: { ...base, height: '1rem', width: '20%' } }), _jsx("div", { style: { ...base, height: '1rem', flex: 1 } })] }, i))) }));
        case 'tree-node':
            return (_jsxs("div", { role: "status", "aria-label": "Loading", className: className, style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }, children: [_jsx("div", { style: { ...base, width: '1rem', height: '1rem', flexShrink: 0 } }), _jsx("div", { style: { ...base, height: '0.875rem', width: '50%' } })] }));
        case 'detail-panel':
            return (_jsxs("div", { role: "status", "aria-label": "Loading", className: className, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)' }, children: [_jsx("div", { style: { ...base, height: '1.5rem', width: '50%' } }), _jsx("div", { style: { ...base, height: '1rem', width: '80%' } }), _jsx("div", { style: { ...base, height: '2.5rem', width: '100%' } }), _jsx("div", { style: { ...base, height: '1rem', width: '60%' } }), _jsx("div", { style: { ...base, height: '2.5rem', width: '100%' } }), _jsx("div", { style: { ...base, height: '1rem', width: '70%' } })] }));
        case 'search-result':
            return (_jsx("div", { role: "status", "aria-label": "Loading", className: className, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }, children: Array.from({ length: rows }).map((_, i) => (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        border: 'var(--border-card)',
                        borderRadius: 'var(--radius-md)',
                    }, children: [_jsx("div", { style: { ...base, width: '1.5rem', height: '1.5rem', flexShrink: 0, borderRadius: 'var(--radius-sm)' } }), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }, children: [_jsx("div", { style: { ...base, height: '0.875rem', width: '40%' } }), _jsx("div", { style: { ...base, height: '0.75rem', width: '60%' } })] })] }, i))) }));
        case 'badge-title':
            return (_jsxs("div", { role: "status", "aria-label": "Loading", className: className, style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }, children: [_jsx("div", { style: { ...base, width: '1.5rem', height: '1.5rem', borderRadius: 'var(--radius-sm)', flexShrink: 0 } }), _jsx("div", { style: { ...base, height: '1rem', width: '40%' } })] }));
        default:
            return null;
    }
}
