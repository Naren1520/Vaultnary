import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/ui/Sidebar'
import ErrorBoundary from '../../components/feedback/ErrorBoundary'
import { ToastProvider } from '../../components/ui/Toast'
import Loader from '../../components/ui/Loader'

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
  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main
          id="main-content"
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
        >
          <ErrorBoundary>
            <Suspense fallback={<InnerLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  )
}
