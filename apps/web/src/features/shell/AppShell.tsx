import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/ui/Sidebar'
import ErrorBoundary from '../../components/feedback/ErrorBoundary'
import { ToastProvider } from '../../components/ui/Toast'

/**
 * Authenticated app shell — sidebar + main content area.
 * All /app/* routes render inside here via <Outlet />.
 */
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
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  )
}
