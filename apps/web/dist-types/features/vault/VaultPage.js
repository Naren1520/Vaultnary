import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Topbar from '../../components/ui/Topbar';
import Inspector from '../../components/ui/Inspector';
import EmptyState from '../../components/feedback/EmptyState';
import VaultList from './VaultList';
export default function VaultPage() {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Vault', href: '/app/vault' }] }), _jsxs("div", { style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }, children: _jsx(VaultList, {}) }), _jsx(Inspector, { children: _jsx(EmptyState, { title: "Select an item", message: "Click a credential to view its details." }) })] })] }));
}
