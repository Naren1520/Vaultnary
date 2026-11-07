import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Plus } from 'lucide-react';
import Topbar from '../../components/ui/Topbar';
import Inspector from '../../components/ui/Inspector';
import EmptyState from '../../components/feedback/EmptyState';
import { useVaultStore } from '../../state/vault-store';
import VaultUnlockScreen from './VaultUnlockScreen';
import VaultList from './VaultList';
import VaultItemForm from '../../components/forms/VaultItemForm';
export default function VaultPage() {
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    const [, forceUpdate] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [listKey, setListKey] = useState(0);
    function handleUnlocked() {
        forceUpdate((n) => n + 1);
    }
    function handleCreated(id) {
        setShowCreate(false);
        if (id)
            setListKey((k) => k + 1); // re-mount VaultList to refresh
    }
    if (!isUnlocked) {
        return _jsx(VaultUnlockScreen, { onUnlocked: handleUnlocked });
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Vault', href: '/app/vault' }], actionsSlot: _jsxs("button", { onClick: () => setShowCreate(true), style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-2) var(--space-4)',
                        backgroundColor: 'var(--color-text)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        cursor: 'pointer',
                    }, children: [_jsx(Plus, { size: 14, "aria-hidden": "true" }), "New credential"] }) }), _jsxs("div", { style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }, children: _jsx(VaultList, {}, listKey) }), _jsx(Inspector, { children: _jsx("div", { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx(EmptyState, { title: "Nothing selected", message: "Click a credential to view its details." }) }) })] }), showCreate && (_jsx("div", { role: "presentation", onClick: (e) => { if (e.target === e.currentTarget)
                    setShowCreate(false); }, style: {
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    zIndex: 200,
                    padding: 'var(--space-8) var(--space-4)',
                    overflowY: 'auto',
                }, children: _jsxs("div", { style: {
                        backgroundColor: 'var(--color-bg)',
                        border: 'var(--border-card)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                        width: '100%',
                        maxWidth: '36rem',
                        position: 'relative',
                    }, children: [_jsx("button", { onClick: () => setShowCreate(false), "aria-label": "Close", style: {
                                position: 'absolute',
                                top: 'var(--space-4)',
                                right: 'var(--space-4)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-text-muted)',
                                fontSize: '1.25rem',
                                lineHeight: 1,
                            }, children: "\u00D7" }), _jsx(VaultItemForm, { onSuccess: handleCreated })] }) }))] }));
}
