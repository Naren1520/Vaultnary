import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Plus } from 'lucide-react';
import Topbar from '../../components/ui/Topbar';
import Inspector from '../../components/ui/Inspector';
import EmptyState from '../../components/feedback/EmptyState';
import { useVaultStore } from '../../state/vault-store';
import VaultUnlockScreen from './VaultUnlockScreen';
import VaultList from './VaultList';
export default function VaultPage() {
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    const [, forceUpdate] = useState(0);
    function handleUnlocked() {
        forceUpdate((n) => n + 1);
    }
    if (!isUnlocked) {
        return _jsx(VaultUnlockScreen, { onUnlocked: handleUnlocked });
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Vault', href: '/app/vault' }], actionsSlot: _jsxs("button", { style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-text)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        cursor: 'pointer',
                    }, children: [_jsx(Plus, { size: 14, "aria-hidden": "true" }), "New credential"] }) }), _jsxs("div", { style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }, children: _jsx(VaultList, {}) }), _jsx(Inspector, { children: _jsx("div", { style: {
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, children: _jsx(EmptyState, { title: "Nothing selected", message: "Click a credential to view its details." }) }) })] })] }));
}
