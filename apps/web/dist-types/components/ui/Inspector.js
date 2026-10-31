import { jsx as _jsx } from "react/jsx-runtime";
import SkeletonLoader from './SkeletonLoader';
export default function Inspector({ loading = false, children, title }) {
    return (_jsx("aside", { "aria-label": title ?? 'Detail panel', style: {
            width: 'var(--inspector-width)',
            minHeight: '100%',
            borderLeft: 'var(--border-card)',
            backgroundColor: 'var(--color-bg)',
            flexShrink: 0,
            overflowY: 'auto',
        }, children: loading ? (_jsx(SkeletonLoader, { variant: "detail-panel" })) : (children) }));
}
