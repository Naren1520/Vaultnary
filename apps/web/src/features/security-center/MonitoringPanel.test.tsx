import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}))

vi.mock('../../services/http-client', () => ({
  apiGet: mocks.apiGet,
}))

import MonitoringPanel from './MonitoringPanel'

describe('MonitoringPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === '/api/v1/security/monitoring') {
        return Promise.resolve({
          data: Array.from({ length: 24 }, (_, index) => ({
            hour: `2026-01-01T${String(index).padStart(2, '0')}:00:00Z`,
            reads: index + 2,
            writes: index % 3,
            errors: index === 12 ? 2 : 0,
          })),
        })
      }
      if (path === '/api/v1/security/speed-test') {
        return Promise.resolve({ payload: 'x'.repeat(1024) })
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`))
    })
  })

  it('renders security metrics, charts, and an explanatory network estimate', async () => {
    render(<MonitoringPanel />)

    expect(await screen.findByRole('heading', { name: 'Account security monitoring' }))
      .toBeInTheDocument()
    expect(screen.getByText('Account status')).toBeInTheDocument()
    expect(screen.getByText('API requests')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Hourly API reads and writes over the last 24 hours' }))
      .toBeInTheDocument()
    expect(screen.getByText(/illustrative browser-to-API transfer estimate/i))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('shows a retryable timeout instead of remaining on the loading screen', async () => {
    vi.useFakeTimers()
    mocks.apiGet.mockImplementation(() => new Promise(() => {}))

    render(<MonitoringPanel />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_100)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Monitoring is taking too long')
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    vi.useRealTimers()
  })
})
