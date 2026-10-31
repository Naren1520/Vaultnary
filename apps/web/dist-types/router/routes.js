import { jsx as _jsx } from "react/jsx-runtime";
import { Suspense, lazy } from 'react';
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../state/auth-store';
import { useVaultStore } from '../state/vault-store';
import Loader from '../components/ui/Loader';
const LandingPage = lazy(() => import('../features/landing/LandingPage'));
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const RegisterPage = lazy(() => import('../features/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('../features/auth/ForgotPasswordPage'));
const AppShell = lazy(() => import('../features/shell/AppShell'));
const VaultPage = lazy(() => import('../features/vault/VaultPage'));
const VaultItemDetail = lazy(() => import('../features/vault/VaultItemDetail'));
const HierarchyPage = lazy(() => import('../features/hierarchy/HierarchyPage'));
const ProjectsPage = lazy(() => import('../features/projects/ProjectsPage'));
const ProjectDetail = lazy(() => import('../features/projects/ProjectDetail'));
const ServicesPage = lazy(() => import('../features/services/ServicesPage'));
const ServiceDetail = lazy(() => import('../features/services/ServiceDetail'));
const SecurityCenterPage = lazy(() => import('../features/security-center/SecurityCenterPage'));
const AuditLogPage = lazy(() => import('../features/audit/AuditLogPage'));
function ProtectedRoute() {
    const csrfToken = useAuthStore((s) => s.csrfToken);
    if (!csrfToken)
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(Outlet, {});
}
function VaultUnlockGate() {
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    if (!isUnlocked)
        return _jsx(Navigate, { to: "/app/vault", replace: true });
    return _jsx(Outlet, {});
}
function PageLoader() {
    return (_jsx("div", { role: "status", "aria-label": "Loading page", style: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-bg)',
        }, children: _jsx(Loader, { size: 72 }) }));
}
function wrap(El) {
    return (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(El, {}) }));
}
export const router = createBrowserRouter([
    // Landing page
    { path: '/', element: wrap(LandingPage) },
    // Public auth routes
    { path: '/login', element: wrap(LoginPage) },
    { path: '/register', element: wrap(RegisterPage) },
    { path: '/verify-email', element: wrap(VerifyEmailPage) },
    { path: '/forgot-password', element: wrap(ForgotPasswordPage) },
    // Authenticated app
    {
        path: '/app',
        element: _jsx(ProtectedRoute, {}),
        children: [
            {
                element: wrap(AppShell),
                children: [
                    { index: true, element: _jsx(Navigate, { to: "vault", replace: true }) },
                    // Vault (unlock-gated)
                    {
                        path: 'vault',
                        element: _jsx(VaultUnlockGate, {}),
                        children: [
                            { index: true, element: wrap(VaultPage) },
                            { path: ':itemId', element: wrap(VaultItemDetail) },
                        ],
                    },
                    // Hierarchy (unlock-gated)
                    {
                        path: 'hierarchy',
                        element: _jsx(VaultUnlockGate, {}),
                        children: [{ index: true, element: wrap(HierarchyPage) }],
                    },
                    { path: 'projects', element: wrap(ProjectsPage) },
                    { path: 'projects/:projectId', element: wrap(ProjectDetail) },
                    { path: 'services', element: wrap(ServicesPage) },
                    { path: 'services/:serviceId', element: wrap(ServiceDetail) },
                    { path: 'security', element: wrap(SecurityCenterPage) },
                    { path: 'audit', element: wrap(AuditLogPage) },
                ],
            },
        ],
    },
    // Catch-all
    { path: '*', element: _jsx(Navigate, { to: "/", replace: true }) },
]);
