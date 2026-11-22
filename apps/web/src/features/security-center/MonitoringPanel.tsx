import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  Activity,
  Gauge,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  Zap,
} from 'lucide-react'
import { apiGet } from '../../services/http-client'
import './monitoring.css'

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

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  tone?: 'neutral' | 'good' | 'warning'
}) {
  return (
    <article className={`monitoring-metric-card monitoring-metric-card--${tone}`}>
      <span className="monitoring-metric-card__icon" aria-hidden="true">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}

function RequestChart({ metrics }: { metrics: HourlyMetric[] }) {
  const max = Math.max(1, ...metrics.map((point) => point.reads + point.writes))
  const chartHeight = 210
  const chartTop = 18
  const chartWidth = 720
  const chartBottom = chartTop + chartHeight
  const barWidth = 11
  const slotWidth = chartWidth / metrics.length
  const gridMax = max

  return (
    <div className="monitoring-chart-scroll">
      <svg
        viewBox="0 0 720 256"
        role="img"
        aria-label="Hourly API reads and writes over the last 24 hours"
        className="monitoring-request-chart"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y = chartTop + (chartHeight / 4) * line
          const value = Math.round(gridMax - (gridMax / 4) * line)
          return (
            <g key={line}>
              <line x1="38" x2="720" y1={y} y2={y} stroke="#e8ebf0" strokeDasharray="3 5" />
              <text x="2" y={y + 4} fill="#8791a1" fontSize="10">{value}</text>
            </g>
          )
        })}
        {metrics.map((point, index) => {
          const x = 38 + index * slotWidth + (slotWidth - barWidth) / 2
          const readHeight = (point.reads / max) * chartHeight
          const writeHeight = (point.writes / max) * chartHeight
          const date = new Date(point.hour)
          const title = `${date.toLocaleString()}: ${point.reads} reads, ${point.writes} writes, ${point.errors} errors`
          const shouldLabel = index % 4 === 0 || index === metrics.length - 1
          return (
            <g key={point.hour}>
              <title>{title}</title>
              <rect
                x={x}
                y={chartBottom - writeHeight - readHeight}
                width={barWidth}
                height={writeHeight}
                rx="3"
                fill="#6c8ff0"
              />
              <rect
                x={x}
                y={chartBottom - readHeight}
                width={barWidth}
                height={readHeight}
                rx="3"
                fill="#23a58b"
              />
              {shouldLabel && (
                <text
                  x={x + barWidth / 2}
                  y="248"
                  fill="#8791a1"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function SpeedChart({ samples }: { samples: SpeedSample[] }) {
  if (samples.length < 2) {
    return (
      <div className="monitoring-chart-empty">
        Speed history will appear after the next periodic check.
      </div>
    )
  }

  const max = Math.max(0.1, ...samples.map((sample) => sample.mbps))
  const areaPoints = samples.map((sample, index) => {
    const x = 12 + (index / (samples.length - 1)) * 676
    const y = 96 - (sample.mbps / max) * 72
    return `${x},${y}`
  }).join(' ')
  const area = `12,104 ${areaPoints} 688,104`
  const points = samples.map((sample, index) => {
    const x = 12 + (index / (samples.length - 1)) * 676
    const y = 96 - (sample.mbps / max) * 72
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 0 700 110" role="img" aria-label="Estimated download speed from recent checks" className="monitoring-speed-chart">
      {[24, 48, 72, 96].map((y) => (
        <line key={y} x1="12" x2="688" y1={y} y2={y} stroke="#edf0f4" strokeDasharray="3 5" />
      ))}
      <polygon points={area} fill="#edf3ff" />
      <polyline points={points} fill="none" stroke="#376de5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {samples.map((sample, index) => {
        const x = 12 + (index / (samples.length - 1)) * 676
        const y = 96 - (sample.mbps / max) * 72
        return <circle key={sample.at} cx={x} cy={y} r="3.5" fill="#376de5"><title>{sample.mbps.toFixed(2)} Mbps</title></circle>
      })}
    </svg>
  )
}

export default function MonitoringPanel() {
  const [metrics, setMetrics] = useState<HourlyMetric[]>([])
  const [samples, setSamples] = useState<SpeedSample[]>([])
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const refreshingRef = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    setError('')
    const timeoutId = window.setTimeout(() => {
      if (signal?.aborted) return
      setError('Monitoring is taking too long to respond. Check the API connection and retry.')
      refreshingRef.current = false
      setRefreshing(false)
    }, 12_000)

    try {
      const startedAt = performance.now()
      const speedStartedAt = performance.now()
      const [metricsResult, speedResult] = await Promise.allSettled([
        apiGet<{ data: HourlyMetric[] }>(
          '/api/v1/security/monitoring',
          { signal },
        ),
        apiGet<{ payload: string }>(
          '/api/v1/security/speed-test',
          { signal },
        ),
      ])

      if (metricsResult.status === 'fulfilled') {
        setLatencyMs(Math.round(performance.now() - startedAt))
        setMetrics(metricsResult.value.data)
        setLastChecked(Date.now())
      }

      if (speedResult.status === 'fulfilled') {
        const durationMs = Math.max(performance.now() - speedStartedAt, 1)
        const mbps = (speedResult.value.payload.length * 8) / (durationMs * 1000)
        setSamples((current) => [...current, { at: Date.now(), mbps }].slice(-12))
      }

      const failures = [metricsResult, speedResult].filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      )
      if (failures.length > 0) {
        const failure = failures[0].reason
        setError(
          failure instanceof Error
            ? failure.message
            : 'Monitoring data could not be refreshed. Check your connection and try again.',
        )
      } else {
        setError('')
      }
    } catch (cause) {
      if (signal?.aborted) return
      setError(
        cause instanceof Error
          ? cause.message
          : 'Monitoring data could not be refreshed. Check your connection and try again.',
      )
    } finally {
      window.clearTimeout(timeoutId)
      if (!signal?.aborted) {
        refreshingRef.current = false
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(
      () => void refresh(),
      60_000,
    )
    return () => {
      window.clearInterval(interval)
      refreshingRef.current = false
    }
  }, [refresh])

  const totalReads = metrics.reduce((total, point) => total + point.reads, 0)
  const totalWrites = metrics.reduce((total, point) => total + point.writes, 0)
  const totalErrors = metrics.reduce((total, point) => total + point.errors, 0)
  const mostRecent = metrics[metrics.length - 1]
  const totalRequests = totalReads + totalWrites
  const successRequests = Math.max(totalRequests - totalErrors, 0)
  const successRate = totalRequests > 0
    ? (successRequests / totalRequests) * 100
    : 100
  const peakHour = useMemo(
    () => [...metrics].sort((a, b) => (
      (b.reads + b.writes) - (a.reads + a.writes)
    ))[0],
    [metrics],
  )
  const latestSpeed = samples[samples.length - 1]?.mbps ?? null
  const averageSpeed = samples.length
    ? samples.reduce((total, sample) => total + sample.mbps, 0) / samples.length
    : null
  const healthTone = totalErrors > 0 || (latencyMs !== null && latencyMs >= 1200)
    ? 'warning'
    : 'good'
  const healthLabel = healthTone === 'warning' ? 'Needs attention' : 'Healthy'

  return (
    <div className="monitoring-dashboard">
      <div className="monitoring-dashboard__header">
        <div>
          <p className="monitoring-dashboard__eyebrow">Last 24 hours</p>
          <h2>Account security monitoring</h2>
        </div>
        <button
          type="button"
          className="monitoring-refresh"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? 'is-spinning' : undefined} aria-hidden="true" />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="monitoring-alert" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <section className="monitoring-metric-grid" aria-label="Account activity summary">
        <MetricCard
          label="Account status"
          value={healthLabel}
          detail={totalErrors === 0 ? 'No failed responses recorded' : `${totalErrors} failed response${totalErrors === 1 ? '' : 's'}`}
          icon={healthTone === 'good' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          tone={healthTone}
        />
        <MetricCard
          label="Requests · 24 hours"
          value={totalRequests.toLocaleString()}
          detail="Read and write operations"
          icon={<Activity size={18} />}
        />
        <MetricCard
          label="Success rate"
          value={`${successRate.toFixed(1)}%`}
          detail={`${successRequests.toLocaleString()} successful responses`}
          icon={<Zap size={18} />}
          tone={successRate >= 99 ? 'good' : 'warning'}
        />
        <MetricCard
          label="Response time"
          value={latencyMs === null ? '—' : `${latencyMs} ms`}
          detail="API round-trip from this browser"
          icon={<Gauge size={18} />}
          tone={latencyMs !== null && latencyMs < 1200 ? 'good' : 'warning'}
        />
      </section>

      <div className="monitoring-content-grid">
        <section className="monitoring-panel" aria-labelledby="request-chart-title">
          <div className="monitoring-panel__header">
            <div>
              <p className="monitoring-panel__eyebrow">Hourly activity</p>
              <h3 id="request-chart-title">API requests</h3>
            </div>
            <div className="monitoring-chart-legend" aria-label="Chart legend">
              <span className="monitoring-chart-legend__reads">Reads</span>
              <span className="monitoring-chart-legend__writes">Writes</span>
            </div>
          </div>
          {metrics.length > 0
            ? <RequestChart metrics={metrics} />
            : <div className="monitoring-chart-empty">No activity recorded yet.</div>}
        </section>

        <aside className="monitoring-side-column">
          <section className="monitoring-panel monitoring-health-panel" aria-labelledby="health-chart-title">
            <div className="monitoring-panel__header">
              <div>
                <p className="monitoring-panel__eyebrow">Response health</p>
                <h3 id="health-chart-title">Success vs. errors</h3>
              </div>
            </div>
            <div className="monitoring-donut-row">
              <div
                className="monitoring-donut"
                style={{ '--success-rate': `${successRate * 3.6}deg` } as CSSProperties}
                role="img"
                aria-label={`${successRate.toFixed(1)} percent of API responses were successful`}
              >
                <div>
                  <strong>{successRate.toFixed(0)}%</strong>
                  <span>success</span>
                </div>
              </div>
              <dl className="monitoring-health-list">
                <div>
                  <dt>Successful</dt>
                  <dd>{successRequests.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{totalErrors.toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="monitoring-panel monitoring-peak-panel" aria-labelledby="peak-hour-title">
            <p className="monitoring-panel__eyebrow" id="peak-hour-title">Peak activity</p>
            <strong>
              {peakHour
                ? new Date(peakHour.hour).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </strong>
            <span>
              {peakHour
                ? `${(peakHour.reads + peakHour.writes).toLocaleString()} requests in the busiest hour`
                : 'Waiting for activity'}
            </span>
          </section>
        </aside>
      </div>

      <section className="monitoring-panel monitoring-network-panel" aria-labelledby="connection-title">
        <div className="monitoring-panel__header">
          <div>
            <p className="monitoring-panel__eyebrow">Browser connection</p>
            <h3 id="connection-title">Network estimate</h3>
          </div>
          <span className="monitoring-updated">
            {lastChecked
              ? `Updated ${new Date(lastChecked).toLocaleTimeString()}`
              : 'Waiting for first check'}
          </span>
        </div>
        <div className="monitoring-network-grid">
          <div className="monitoring-network-stats">
            <MetricCard
              label="Latest estimate"
              value={latestSpeed === null ? '—' : `${latestSpeed.toFixed(2)} Mbps`}
              detail="Approximate browser transfer"
              icon={<Wifi size={18} />}
            />
            <MetricCard
              label="Average estimate"
              value={averageSpeed === null ? '—' : `${averageSpeed.toFixed(2)} Mbps`}
              detail={`Across ${samples.length} recent check${samples.length === 1 ? '' : 's'}`}
              icon={<Gauge size={18} />}
            />
          </div>
          <div className="monitoring-network-chart">
            <SpeedChart samples={samples} />
          </div>
        </div>
        <p className="monitoring-estimate-note">
          This is an illustrative browser-to-API transfer estimate, not a formal internet
          speed test. It transfers a small 128 KiB payload and can vary with browser, routing,
          CDN, and server load.
        </p>
      </section>

      <p className="monitoring-dashboard__footer">
        Activity refreshes every minute. The current hour includes{' '}
        {mostRecent ? (mostRecent.reads + mostRecent.writes).toLocaleString() : '0'} requests.
      </p>
    </div>
  )
}
