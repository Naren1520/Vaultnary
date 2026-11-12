import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Topbar from '../../components/ui/Topbar';
import VaultTree from './VaultTree';
export default function HierarchyPage() {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Hierarchy', href: '/app/hierarchy' }] }), _jsxs("div", { className: "app-page-content", style: { padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }, children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Explore your vault" }), _jsx("h1", { children: "Hierarchy" }), _jsx("p", { children: "Browse credentials through their folder and parent-child relationships." })] }), _jsx(VaultTree, {})] })] }));
}
