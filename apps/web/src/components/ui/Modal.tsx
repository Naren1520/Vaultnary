import React, { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onClose: () => void
  children?: React.ReactNode
  /** Marks the confirm button as destructive (red) */
  destructive?: boolean
}

/**
 * Accessible modal dialog.
 * - Focus is trapped inside while open
 * - Closes on Escape key
 * - No action occurs without explicit user confirmation
 */
export default function Modal({
  open,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  children,
  destructive = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Focus trap and Escape key handler
  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus the dialog
    const dialog = dialogRef.current
    if (dialog) {
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      focusable[0]?.focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: 'var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          width: '100%',
          maxWidth: '28rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            id="modal-title"
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text)',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        {children && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            {children}
          </div>
        )}

        {/* Actions */}
        {onConfirm && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button
              onClick={onClose}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                border: 'var(--border-input)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                backgroundColor: 'var(--color-bg)',
              }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: '#fff',
                backgroundColor: destructive ? 'var(--color-danger)' : 'var(--color-accent)',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
