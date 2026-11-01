import { Suspense, lazy } from 'react'
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
import { useAuthStore } from '../state/auth-store'
import Loader from '../components/ui/Loader'

const LandingPage = lazy(() => import('../features/landing/LandingPage'))
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

function ProtectedRoute() {
  const csrfToken = useAuthStore((s) => s.csrfToken)
  if (!csrfToken) return <Navigate to="/login" replace />
  return <Outlet />
}

function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <Loader size={72} />
    </div>
  )
}

function wrap(El: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <El />
    </Suspense>
  )
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
    element: <ProtectedRoute />,
    children: [
      {
        element: wrap(AppShell),
        children: [
          { index: true, element: <Navigate to="vault" replace /> },

          // Vault
          { path: 'vault', element: wrap(VaultPage) },
          { path: 'vault/:itemId', element: wrap(VaultItemDetail) },

          // Hierarchy
          { path: 'hierarchy', element: wrap(HierarchyPage) },

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
  { path: '*', element: <Navigate to="/" replace /> },
])
