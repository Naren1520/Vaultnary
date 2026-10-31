import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'

interface SecretFieldProps {
  itemId: string
  label: string
  /** Pre-decrypted value — if not provided field stays masked until decrypt is wired */
  value?: string
}

const MASK_TIMEOUT_MS = 30_000
const CLIPBOARD_CLEAR_MS = 30_000
const COPY_TOAST_MS = 3_000

/**
 * Masked secret field.
 * - Reveal toggle: decrypts and shows value for 30 s, then re-masks
 * - Copy: writes to clipboard, clears after 30 s, shows toast for 3 s
 * - Never writes plaintext to localStorage, sessionStorage, or any URL
 */
export default function SecretField({ label, value }: SecretFieldProps) {
  const { showToast } = useToast()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const maskTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clipboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearMaskTimer() {
    if (maskTimer.current) { clearTimeout(maskTimer.current); maskTimer.current = null }
  }

  function scheduleMask() {
    clearMaskTimer()
    maskTimer.current = setTimeout(() => setRevealed(false), MASK_TIMEOUT_MS)
  }

  function handleReveal() {
    if (revealed) {
      clearMaskTimer()
      setRevealed(false)
    } else {
      setRevealed(true)
      scheduleMask()
    }
  }

  const handleCopy = useCallback(async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      showToast({ message: 'Copied to clipboard', type: 'success', duration: COPY_TOAST_MS })

      // Clear clipboard after 30 s
      if (clipboardTimer.current) clearTimeout(clipboardTimer.current)
      clipboardTimer.current = setTimeout(async () => {
        try { await navigator.clipboard.writeText('') } catch { /* ignore */ }
      }, CLIPBOARD_CLEAR_MS)

      setTimeout(() => setCopied(false), COPY_TOAST_MS)
    } catch {
      showToast({ message: 'Could not access clipboard', type: 'error' })
    }
  }, [value, showToast])

  // Cleanup timers on unmount
  useEffect(() => () => { clearMaskTimer(); if (clipboardTimer.current) clearTimeout(clipboardTimer.current) }, [])

  const displayValue = revealed && value ? value : '••••••••••••'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          border: 'var(--border-input)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <span
          aria-live="polite"
          aria-label={revealed ? `${label} revealed` : `${label} hidden`}
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {displayValue}
        </span>

        {/* Reveal toggle */}
        <button
          onClick={handleReveal}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          aria-pressed={revealed}
          style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          {revealed
            ? <EyeOff size={14} aria-hidden="true" />
            : <Eye size={14} aria-hidden="true" />
          }
        </button>

        {/* Copy button */}
        {value && (
          <button
            onClick={handleCopy}
            aria-label={`Copy ${label} to clipboard`}
            style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {copied
              ? <Check size={14} aria-hidden="true" />
              : <Copy size={14} aria-hidden="true" />
            }
          </button>
        )}
      </div>
    </div>
  )
}
