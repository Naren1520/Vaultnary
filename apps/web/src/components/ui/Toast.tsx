import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (opts: { message: string; type?: ToastType; duration?: number }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    ({ message, type = 'info', duration = 3000 }: { message: string; type?: ToastType; duration?: number }) => {
      const id = ++nextId
      setToasts((prev) => [...prev, { id, message, type }])
      const timer = setTimeout(() => removeToast(id), duration)
      timers.current.set(id, timer)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastItem[]
  onClose: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        zIndex: 'var(--z-toast)',
        maxWidth: '22rem',
        width: '100%',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: ToastItem; onClose: (id: number) => void }) {
  const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} aria-hidden="true" style={{ color: 'var(--color-success)' }} />,
    error: <AlertCircle size={16} aria-hidden="true" style={{ color: 'var(--color-danger)' }} />,
    info: <Info size={16} aria-hidden="true" style={{ color: 'var(--color-accent)' }} />,
  }

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-bg)',
        border: 'var(--border-card)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text)',
      }}
    >
      {iconMap[toast.type]}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        aria-label="Dismiss notification"
        style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
