import { jsx as _jsx } from "react/jsx-runtime";
import SkeletonLoader from './SkeletonLoader';
export default function Inspector({ loading = false, children, title }) {
    return (_jsx("aside", { "aria-label": title ?? 'Detail panel', className: "app-inspector", children: loading ? (_jsx(SkeletonLoader, { variant: "detail-panel" })) : (children) }));
}
