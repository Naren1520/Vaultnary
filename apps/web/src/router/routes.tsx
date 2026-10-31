import { Suspense, lazy } from 'react'
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
import { useAuthStore } from '../state/auth-store'
import { useVaultStore } from '../state/vault-store'

// Lazy-load feature pages for code splitting
const LoginPage = lazy(() => import('../features/auth/LoginPage'))
const RegisterPage = lazy(() => import('../features/auth/RegisterPage'))
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('../features/auth/ForgotPasswordPage'))
const AppShell = lazy(() => import('../features/shell/AppShell'))
const VaultPage = lazy(() => import('../features/vault/VaultPage'))
const VaultItemDetail = lazy(() => import('../features/vault/VaultItemDetail'))
const HierarchyPage = lazy(() => import('../features/hierarchy/HierarchyPage'))
const ProjectsPage = lazy(() => import('../features/projects/ProjectsPage'))
const ProjectDetail = lazy(() => import('../features/projects/ProjectDetail'))
const ServicesPage = lazy(() => import('../features/services/ServicesPage'))
const ServiceDetail = lazy(() => import('../features/services/ServiceDetail'))
const SecurityCenterPage = lazy(() => import('../features/security-center/SecurityCenterPage'))
const AuditLogPage = lazy(() => import('../features/audit/AuditLogPage'))

/** Redirects to /login if no CSRF token (unauthenticated) */
function ProtectedRoute() {
  const csrfToken = useAuthStore((s) => s.csrfToken)
  if (!csrfToken) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

/** Ensures the vault is unlocked before rendering credential pages */
function VaultUnlockGate() {
  const isUnlocked = useVaultStore((s) => s.isUnlocked)
  if (!isUnlocked) {
    return <Navigate to="/app/vault" replace />
  }
  return <Outlet />
}

function PageLoader() {
  return (
    <div role="status" aria-label="Loading page" style={{ padding: '2rem', textAlign: 'center' }}>
      Loading...
    </div>
  )
}

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<PageLoader />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/verify-email',
    element: (
      <Suspense fallback={<PageLoader />}>
        <VerifyEmailPage />
      </Suspense>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ForgotPasswordPage />
      </Suspense>
    ),
  },

  // Authenticated app routes
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        element: (
          <Suspense fallback={<PageLoader />}>
            <AppShell />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="vault" replace /> },

          // Vault - vault-unlock gate required
          {
            path: 'vault',
            element: <VaultUnlockGate />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <VaultPage />
                  </Suspense>
                ),
              },
              {
                path: ':itemId',
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <VaultItemDetail />
                  </Suspense>
                ),
              },
            ],
          },

          // Hierarchy tree - vault-unlock gate required
          {
            path: 'hierarchy',
            element: <VaultUnlockGate />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <HierarchyPage />
                  </Suspense>
                ),
              },
            ],
          },

          // Projects
          {
            path: 'projects',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ProjectsPage />
              </Suspense>
            ),
          },
          {
            path: 'projects/:projectId',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ProjectDetail />
              </Suspense>
            ),
          },

          // Services
          {
            path: 'services',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesPage />
              </Suspense>
            ),
          },
          {
            path: 'services/:serviceId',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServiceDetail />
              </Suspense>
            ),
          },

          // Security center and audit
          {
            path: 'security',
            element: (
              <Suspense fallback={<PageLoader />}>
                <SecurityCenterPage />
              </Suspense>
            ),
          },
          {
            path: 'audit',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AuditLogPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },

  // Catch-all redirect
  { path: '*', element: <Navigate to="/login" replace /> },
])
