import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Topbar from '../../components/ui/Topbar';
import VaultTree from './VaultTree';
export default function HierarchyPage() {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Hierarchy', href: '/app/hierarchy' }] }), _jsx("div", { style: { padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }, children: _jsx(VaultTree, {}) })] }));
}
