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
      <div className="app-shell">
        <Sidebar />
        <main
          id="main-content"
          className="app-main"
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
