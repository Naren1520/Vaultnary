import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useRef, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import Topbar from '../../components/ui/Topbar';
import Inspector from '../../components/ui/Inspector';
import EmptyState from '../../components/feedback/EmptyState';
import { useVaultStore } from '../../state/vault-store';
import { apiPost } from '../../services/http-client';
import VaultUnlockScreen from './VaultUnlockScreen';
import VaultList from './VaultList';
import VaultItemForm from '../../components/forms/VaultItemForm';
import { verifyVaultArchive } from './archive';
import EnvImportDialog from './env-import/EnvImportDialog';
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const actionStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    border: 'var(--border-card)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: 'pointer',
};
export default function VaultPage() {
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    const privateKey = useVaultStore((s) => s.privateKey);
    const [, forceUpdate] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [showEnvImport, setShowEnvImport] = useState(false);
    const [listKey, setListKey] = useState(0);
    const [archiveBusy, setArchiveBusy] = useState(false);
    const [archiveError, setArchiveError] = useState('');
    const [archiveNotice, setArchiveNotice] = useState('');
    const fileInput = useRef(null);
    function handleUnlocked() {
        forceUpdate((n) => n + 1);
    }
    async function handleExport() {
        setArchiveBusy(true);
        setArchiveError('');
        setArchiveNotice('');
        try {
            const response = await apiPost('/api/v1/vault/export');
            if (!response.data || response.data.version !== 2) {
                throw new Error('The server returned an invalid vault archive.');
            }
            const blob = new Blob([JSON.stringify(response.data, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vaultnary-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
            setArchiveNotice('Vault backup downloaded; secret values remain encrypted.');
        }
        catch (cause) {
            setArchiveError(cause instanceof Error ? cause.message : 'Could not export the vault.');
        }
        finally {
            setArchiveBusy(false);
        }
    }
    async function handleImport(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file)
            return;
        if (!privateKey) {
            setArchiveError('Unlock the vault before importing an archive.');
            return;
        }
        if (file.size > MAX_ARCHIVE_BYTES) {
            setArchiveError('Archive file exceeds the 50 MB limit.');
            return;
        }
        setArchiveBusy(true);
        setArchiveError('');
        setArchiveNotice('');
        try {
            const archive = await verifyVaultArchive(JSON.parse(await file.text()), privateKey);
            const response = await apiPost('/api/v1/vault/import', archive);
            setListKey((key) => key + 1);
            setArchiveNotice(`${response.data.imported} credential${response.data.imported === 1 ? '' : 's'} imported.`);
        }
        catch (cause) {
            setArchiveError(cause instanceof Error ? cause.message : 'Could not import the vault archive.');
        }
        finally {
            setArchiveBusy(false);
        }
    }
    function handleCreated(id) {
        setShowCreate(false);
        if (id)
            setListKey((k) => k + 1); // re-mount VaultList to refresh
    }
    const handleEnvImportClose = useCallback(() => setShowEnvImport(false), []);
    const handleEnvImported = useCallback((count) => {
        setListKey((key) => key + 1);
        if (count > 0) {
            setArchiveNotice(`${count} environment variable${count === 1 ? '' : 's'} encrypted and imported.`);
            setArchiveError('');
        }
    }, []);
    if (!isUnlocked) {
        return _jsx(VaultUnlockScreen, { onUnlocked: handleUnlocked });
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Vault', href: '/app/vault' }], actionsSlot: _jsxs("div", { className: "vault-actions", children: [_jsxs("button", { type: "button", onClick: handleExport, disabled: archiveBusy, style: actionStyle, children: [_jsx(Download, { size: 14, "aria-hidden": "true" }), "Export"] }), _jsxs("button", { type: "button", onClick: () => fileInput.current?.click(), disabled: archiveBusy, style: actionStyle, children: [_jsx(Upload, { size: 14, "aria-hidden": "true" }), "Import backup"] }), _jsxs("button", { type: "button", onClick: () => setShowEnvImport(true), style: actionStyle, children: [_jsx(Upload, { size: 14, "aria-hidden": "true" }), "Import .env"] }), _jsx("input", { ref: fileInput, type: "file", accept: "application/json,.json", "aria-label": "Import encrypted vault archive", onChange: handleImport, style: { display: 'none' } }), _jsxs("button", { type: "button", onClick: () => setShowCreate(true), style: {
                                ...actionStyle,
                                padding: 'var(--space-2) var(--space-4)',
                                backgroundColor: 'var(--color-text)',
                                color: '#fff',
                                border: 'none',
                            }, children: [_jsx(Plus, { size: 14, "aria-hidden": "true" }), "New credential"] })] }) }), (archiveError || archiveBusy || archiveNotice) && (_jsx("div", { role: archiveError ? 'alert' : 'status', style: {
                    padding: 'var(--space-2) var(--space-4)',
                    color: archiveError ? 'var(--color-danger)' : 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)',
                }, children: archiveError || (archiveBusy ? 'Processing archive...' : archiveNotice) })), _jsxs("div", { className: "vault-page-content", style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }, children: [_jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }, children: [_jsxs("header", { className: "app-page-heading", children: [_jsx("p", { className: "app-page-heading__eyebrow", children: "Private by design" }), _jsx("h1", { children: "Your vault" }), _jsx("p", { children: "Your encrypted credentials, ready when you need them." })] }), _jsx(VaultList, { onCreateCredential: () => setShowCreate(true) }, listKey)] }), _jsx(Inspector, { children: _jsx("div", { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx(EmptyState, { title: "Nothing selected", message: "Click a credential to view its details." }) }) })] }), showCreate && (_jsx("div", { role: "presentation", className: "app-modal-overlay", onClick: (e) => { if (e.target === e.currentTarget)
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
                }, children: _jsxs("div", { className: "app-modal-panel", style: {
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
                            }, children: "\u00D7" }), _jsx(VaultItemForm, { onSuccess: handleCreated })] }) })), showEnvImport && (_jsx(EnvImportDialog, { onClose: handleEnvImportClose, onImported: handleEnvImported }))] }));
}
