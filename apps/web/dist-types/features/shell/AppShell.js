import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/ui/Sidebar';
import ErrorBoundary from '../../components/feedback/ErrorBoundary';
import { ToastProvider } from '../../components/ui/Toast';
import Loader from '../../components/ui/Loader';
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
    return (_jsx(ToastProvider, { children: _jsxs("div", { style: { display: 'flex', minHeight: '100vh' }, children: [_jsx(Sidebar, {}), _jsx("main", { id: "main-content", style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }, children: _jsx(ErrorBoundary, { children: _jsx(Suspense, { fallback: _jsx(InnerLoader, {}), children: _jsx(Outlet, {}) }) }) })] }) }));
}
