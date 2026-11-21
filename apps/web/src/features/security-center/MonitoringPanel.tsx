import { useEffect, useState } from 'react'
import { apiGet } from '../../services/http-client'

interface HourlyMetric {
  hour: string
  reads: number
  writes: number
  errors: number
}

interface SpeedSample {
  at: number
  mbps: number
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="app-page-section" style={{ minWidth: 0 }}>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{label}</p>
      <strong style={{ display: 'block', marginTop: 'var(--space-2)', fontSize: 'clamp(1.35rem, 3vw, 1.8rem)', letterSpacing: '-0.04em' }}>{value}</strong>
      <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{detail}</p>
    </article>
  )
}

function RequestChart({ metrics }: { metrics: HourlyMetric[] }) {
  const max = Math.max(1, ...metrics.map((point) => point.reads + point.writes))
  const chartHeight = 142
  const barWidth = 14
  const chartWidth = 720
  const gap = (chartWidth - metrics.length * barWidth) / Math.max(metrics.length - 1, 1)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox="0 0 720 190"
        role="img"
        aria-label="Hourly API reads and writes over the last 24 hours"
        style={{ display: 'block', width: '100%', minWidth: '34rem', height: 'auto' }}
      >
        {[0, 1, 2, 3].map((line) => {
          const y = 16 + line * (chartHeight / 3)
          return <line key={line} x1="0" x2="720" y1={y} y2={y} stroke="#e8ebf0" strokeDasharray="3 5" />
        })}
        {metrics.map((point, index) => {
          const x = index * (barWidth + gap)
          const readHeight = (point.reads / max) * chartHeight
          const writeHeight = (point.writes / max) * chartHeight
          const title = `${new Date(point.hour).toLocaleString()}: ${point.reads} reads, ${point.writes} writes, ${point.errors} errors`
          return (
            <g key={point.hour}>
              <title>{title}</title>
              <rect x={x} y={16 + chartHeight - readHeight - writeHeight} width={barWidth} height={writeHeight} rx="3" fill="#6c8ff0" />
              <rect x={x} y={16 + chartHeight - readHeight} width={barWidth} height={readHeight} rx="3" fill="#23a58b" />
            </g>
          )
        })}
        <text x="0" y="181" fill="#6b7280" fontSize="11">24 hours ago</text>
        <text x="670" y="181" fill="#6b7280" fontSize="11">Now</text>
      </svg>
    </div>
  )
}

function SpeedChart({ samples }: { samples: SpeedSample[] }) {
  if (samples.length < 2) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Speed history will appear after the next periodic check.</p>
  }

  const max = Math.max(0.1, ...samples.map((sample) => sample.mbps))
  const points = samples.map((sample, index) => {
    const x = 8 + (index / (samples.length - 1)) * 684
    const y = 90 - (sample.mbps / max) * 72
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 0 700 110" role="img" aria-label="Estimated download speed from recent checks" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <line x1="8" x2="692" y1="90" y2="90" stroke="#e8ebf0" />
      <polyline points={points} fill="none" stroke="#376de5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {samples.map((sample, index) => {
        const x = 8 + (index / (samples.length - 1)) * 684
        const y = 90 - (sample.mbps / max) * 72
        return <circle key={sample.at} cx={x} cy={y} r="3.5" fill="#376de5"><title>{sample.mbps.toFixed(2)} Mbps</title></circle>
      })}
    </svg>
  )
}

export default function MonitoringPanel() {
  const [metrics, setMetrics] = useState<HourlyMetric[]>([])
  const [samples, setSamples] = useState<SpeedSample[]>([])
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let refreshing = false

    async function refresh() {
      if (refreshing) return
      refreshing = true
      setError('')

      try {
        const startedAt = performance.now()
        const response = await apiGet<{ data: HourlyMetric[] }>('/api/v1/security/monitoring', { signal: controller.signal })
        if (!active) return
        setLatencyMs(Math.round(performance.now() - startedAt))
        setMetrics(response.data)
        setLastChecked(Date.now())
        setLoading(false)

        const speedStartedAt = performance.now()
        const probe = await apiGet<{ payload: string }>('/api/v1/security/speed-test', { signal: controller.signal })
        if (!active) return
        const durationMs = Math.max(performance.now() - speedStartedAt, 1)
        const mbps = (probe.payload.length * 8) / (durationMs * 1000)
        setSamples((current) => [...current, { at: Date.now(), mbps }].slice(-12))
      } catch {
        if (!active) return
        setError('Monitoring data could not be refreshed. Check your connection and try again.')
        setLoading(false)
      } finally {
        refreshing = false
      }
    }

    void refresh()
    const interval = window.setInterval(() => void refresh(), 60_000)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(interval)
    }
  }, [])

  const totalReads = metrics.reduce((total, point) => total + point.reads, 0)
  const totalWrites = metrics.reduce((total, point) => total + point.writes, 0)
  const totalErrors = metrics.reduce((total, point) => total + point.errors, 0)
  const mostRecent = metrics[metrics.length - 1]

  if (loading) {
    return <p role="status" style={{ color: 'var(--color-text-muted)' }}>Loading account monitoring…</p>
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <section aria-label="API activity" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))', gap: 'var(--space-3)' }}>
        <MetricCard label="Requests · 24 hours" value={(totalReads + totalWrites).toLocaleString()} detail="Across all your signed-in devices" />
        <MetricCard label="Read requests" value={totalReads.toLocaleString()} detail="Data requests to your account" />
        <MetricCard label="Write requests" value={totalWrites.toLocaleString()} detail="Changes sent to your account" />
        <MetricCard label="Failed requests" value={totalErrors.toLocaleString()} detail="Responses with an error status" />
      </section>

      <section className="app-page-section" aria-labelledby="request-chart-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <h2 id="request-chart-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>API activity</h2>
            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Hourly requests received and changes sent, across your account.</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
            <span style={{ color: '#168b75' }}>● Reads</span>
            <span style={{ color: '#5277d5' }}>● Writes</span>
          </div>
        </div>
        {metrics.length > 0
          ? <RequestChart metrics={metrics} />
          : <p style={{ color: 'var(--color-text-muted)' }}>No activity recorded yet.</p>}
      </section>

      <section className="app-page-section" aria-labelledby="connection-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <h2 id="connection-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Connection to Vaultnary</h2>
            <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Periodic checks while this dashboard is open; each speed check transfers about 128 KiB.</p>
          </div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
            {lastChecked ? `Updated ${new Date(lastChecked).toLocaleTimeString()}` : 'Waiting for first check'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <MetricCard label="Response time" value={latencyMs === null ? '—' : `${latencyMs} ms`} detail="Round trip to the API" />
          <MetricCard label="Download estimate" value={samples.length ? `${samples[samples.length - 1].mbps.toFixed(2)} Mbps` : '—'} detail="Browser-to-API transfer estimate" />
        </div>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <SpeedChart samples={samples} />
        </div>
      </section>

      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
        Request activity refreshes every minute. The current hour includes {mostRecent ? (mostRecent.reads + mostRecent.writes).toLocaleString() : '0'} requests so far.
      </p>
    </div>
  )
}
