import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * React error boundary that catches render errors and shows a friendly message.
 * Never exposes stack traces or technical error details to the user.
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, message: 'Something went wrong.' }
  }

  componentDidCatch(error: unknown) {
    // Log to console in development only -never expose to the user
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-8)',
              textAlign: 'center',
              color: 'var(--color-text)',
            }}
          >
            <p style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--text-lg)' }}>
              Something went wrong
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Please reload the page. If the problem persists, contact support.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                border: 'var(--border-input)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                backgroundColor: 'var(--color-bg)',
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
