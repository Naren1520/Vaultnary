import { jsx as _jsx } from "react/jsx-runtime";
import { Suspense, lazy } from 'react';
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../state/auth-store';
import { useVaultStore } from '../state/vault-store';
// Lazy-load feature pages for code splitting
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
/** Redirects to /login if no CSRF token (unauthenticated) */
function ProtectedRoute() {
    const csrfToken = useAuthStore((s) => s.csrfToken);
    if (!csrfToken) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(Outlet, {});
}
/** Ensures the vault is unlocked before rendering credential pages */
function VaultUnlockGate() {
    const isUnlocked = useVaultStore((s) => s.isUnlocked);
    if (!isUnlocked) {
        return _jsx(Navigate, { to: "/app/vault", replace: true });
    }
    return _jsx(Outlet, {});
}
function PageLoader() {
    return (_jsx("div", { role: "status", "aria-label": "Loading page", style: { padding: '2rem', textAlign: 'center' }, children: "Loading..." }));
}
export const router = createBrowserRouter([
    // Public routes
    {
        path: '/login',
        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(LoginPage, {}) })),
    },
    {
        path: '/register',
        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(RegisterPage, {}) })),
    },
    {
        path: '/verify-email',
        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(VerifyEmailPage, {}) })),
    },
    {
        path: '/forgot-password',
        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(ForgotPasswordPage, {}) })),
    },
    // Authenticated app routes
    {
        path: '/app',
        element: _jsx(ProtectedRoute, {}),
        children: [
            {
                element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(AppShell, {}) })),
                children: [
                    { index: true, element: _jsx(Navigate, { to: "vault", replace: true }) },
                    // Vault - vault-unlock gate required
                    {
                        path: 'vault',
                        element: _jsx(VaultUnlockGate, {}),
                        children: [
                            {
                                index: true,
                                element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(VaultPage, {}) })),
                            },
                            {
                                path: ':itemId',
                                element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(VaultItemDetail, {}) })),
                            },
                        ],
                    },
                    // Hierarchy tree - vault-unlock gate required
                    {
                        path: 'hierarchy',
                        element: _jsx(VaultUnlockGate, {}),
                        children: [
                            {
                                index: true,
                                element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(HierarchyPage, {}) })),
                            },
                        ],
                    },
                    // Projects
                    {
                        path: 'projects',
                        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(ProjectsPage, {}) })),
                    },
                    {
                        path: 'projects/:projectId',
                        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(ProjectDetail, {}) })),
                    },
                    // Services
                    {
                        path: 'services',
                        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(ServicesPage, {}) })),
                    },
                    {
                        path: 'services/:serviceId',
                        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(ServiceDetail, {}) })),
                    },
                    // Security center and audit
                    {
                        path: 'security',
                        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(SecurityCenterPage, {}) })),
                    },
                    {
                        path: 'audit',
                        element: (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(AuditLogPage, {}) })),
                    },
                ],
            },
        ],
    },
    // Catch-all redirect
    { path: '*', element: _jsx(Navigate, { to: "/login", replace: true }) },
]);
