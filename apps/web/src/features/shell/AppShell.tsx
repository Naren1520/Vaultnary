import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import Sidebar from '../../components/ui/Sidebar'
import ErrorBoundary from '../../components/feedback/ErrorBoundary'
import { ToastProvider } from '../../components/ui/Toast'
import Loader from '../../components/ui/Loader'
import { useVaultStore } from '../../state/vault-store'
import VaultUnlockScreen from '../vault/VaultUnlockScreen'

function InnerLoader() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <Loader size={64} />
    </div>
  )
}

export default function AppShell() {
  const location = useLocation()
  const isUnlocked = useVaultStore((state) => state.isUnlocked)
  const requiresVaultUnlock =
    location.pathname.startsWith('/app/vault') ||
    location.pathname.startsWith('/app/hierarchy')

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <main
          id="main-content"
          className="app-main"
        >
          <ErrorBoundary>
            <Suspense fallback={<InnerLoader />}>
              {requiresVaultUnlock && !isUnlocked
                ? <VaultUnlockScreen onUnlocked={() => undefined} />
                : <Outlet />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  )
}
