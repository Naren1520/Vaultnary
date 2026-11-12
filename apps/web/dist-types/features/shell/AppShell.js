import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Sidebar from '../../components/ui/Sidebar';
import ErrorBoundary from '../../components/feedback/ErrorBoundary';
import { ToastProvider } from '../../components/ui/Toast';
import Loader from '../../components/ui/Loader';
import { useVaultStore } from '../../state/vault-store';
import VaultUnlockScreen from '../vault/VaultUnlockScreen';
function InnerLoader() {
    return (_jsx("div", { style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
        }, children: _jsx(Loader, { size: 64 }) }));
}
export default function AppShell() {
    const location = useLocation();
    const isUnlocked = useVaultStore((state) => state.isUnlocked);
    const requiresVaultUnlock = location.pathname.startsWith('/app/vault') ||
        location.pathname.startsWith('/app/hierarchy');
    return (_jsx(ToastProvider, { children: _jsxs("div", { className: "app-shell", children: [_jsx(Sidebar, {}), _jsx("main", { id: "main-content", className: "app-main", children: _jsx(ErrorBoundary, { children: _jsx(Suspense, { fallback: _jsx(InnerLoader, {}), children: requiresVaultUnlock && !isUnlocked
                                ? _jsx(VaultUnlockScreen, { onUnlocked: () => undefined })
                                : _jsx(Outlet, {}) }) }) })] }) }));
}
