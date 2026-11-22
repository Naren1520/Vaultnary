import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { Activity, Gauge, RefreshCw, ShieldAlert, ShieldCheck, Wifi, Zap, } from 'lucide-react';
import { apiGet } from '../../services/http-client';
import './monitoring.css';
function MetricCard({ label, value, detail, icon, tone = 'neutral', }) {
    return (_jsxs("article", { className: `monitoring-metric-card monitoring-metric-card--${tone}`, children: [_jsx("span", { className: "monitoring-metric-card__icon", "aria-hidden": "true", children: icon }), _jsxs("div", { children: [_jsx("p", { children: label }), _jsx("strong", { children: value }), _jsx("span", { children: detail })] })] }));
}
function RequestChart({ metrics }) {
    const max = Math.max(1, ...metrics.map((point) => point.reads + point.writes));
    const chartHeight = 210;
    const chartTop = 18;
    const chartWidth = 720;
    const chartBottom = chartTop + chartHeight;
    const barWidth = 11;
    const slotWidth = chartWidth / metrics.length;
    const gridMax = max;
    return (_jsx("div", { className: "monitoring-chart-scroll", children: _jsxs("svg", { viewBox: "0 0 720 256", role: "img", "aria-label": "Hourly API reads and writes over the last 24 hours", className: "monitoring-request-chart", children: [[0, 1, 2, 3, 4].map((line) => {
                    const y = chartTop + (chartHeight / 4) * line;
                    const value = Math.round(gridMax - (gridMax / 4) * line);
                    return (_jsxs("g", { children: [_jsx("line", { x1: "38", x2: "720", y1: y, y2: y, stroke: "#e8ebf0", strokeDasharray: "3 5" }), _jsx("text", { x: "2", y: y + 4, fill: "#8791a1", fontSize: "10", children: value })] }, line));
                }), metrics.map((point, index) => {
                    const x = 38 + index * slotWidth + (slotWidth - barWidth) / 2;
                    const readHeight = (point.reads / max) * chartHeight;
                    const writeHeight = (point.writes / max) * chartHeight;
                    const date = new Date(point.hour);
                    const title = `${date.toLocaleString()}: ${point.reads} reads, ${point.writes} writes, ${point.errors} errors`;
                    const shouldLabel = index % 4 === 0 || index === metrics.length - 1;
                    return (_jsxs("g", { children: [_jsx("title", { children: title }), _jsx("rect", { x: x, y: chartBottom - writeHeight - readHeight, width: barWidth, height: writeHeight, rx: "3", fill: "#6c8ff0" }), _jsx("rect", { x: x, y: chartBottom - readHeight, width: barWidth, height: readHeight, rx: "3", fill: "#23a58b" }), shouldLabel && (_jsx("text", { x: x + barWidth / 2, y: "248", fill: "#8791a1", fontSize: "9", textAnchor: "middle", children: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))] }, point.hour));
                })] }) }));
}
function SpeedChart({ samples }) {
    if (samples.length < 2) {
        return (_jsx("div", { className: "monitoring-chart-empty", children: "Speed history will appear after the next periodic check." }));
    }
    const max = Math.max(0.1, ...samples.map((sample) => sample.mbps));
    const areaPoints = samples.map((sample, index) => {
        const x = 12 + (index / (samples.length - 1)) * 676;
        const y = 96 - (sample.mbps / max) * 72;
        return `${x},${y}`;
    }).join(' ');
    const area = `12,104 ${areaPoints} 688,104`;
    const points = samples.map((sample, index) => {
        const x = 12 + (index / (samples.length - 1)) * 676;
        const y = 96 - (sample.mbps / max) * 72;
        return `${x},${y}`;
    }).join(' ');
    return (_jsxs("svg", { viewBox: "0 0 700 110", role: "img", "aria-label": "Estimated download speed from recent checks", className: "monitoring-speed-chart", children: [[24, 48, 72, 96].map((y) => (_jsx("line", { x1: "12", x2: "688", y1: y, y2: y, stroke: "#edf0f4", strokeDasharray: "3 5" }, y))), _jsx("polygon", { points: area, fill: "#edf3ff" }), _jsx("polyline", { points: points, fill: "none", stroke: "#376de5", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" }), samples.map((sample, index) => {
                const x = 12 + (index / (samples.length - 1)) * 676;
                const y = 96 - (sample.mbps / max) * 72;
                return _jsx("circle", { cx: x, cy: y, r: "3.5", fill: "#376de5", children: _jsxs("title", { children: [sample.mbps.toFixed(2), " Mbps"] }) }, sample.at);
            })] }));
}
export default function MonitoringPanel() {
    const [metrics, setMetrics] = useState([]);
    const [samples, setSamples] = useState([]);
    const [latencyMs, setLatencyMs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lastChecked, setLastChecked] = useState(null);
    const refreshingRef = useRef(false);
    const refresh = useCallback(async (signal) => {
        if (refreshingRef.current)
            return;
        refreshingRef.current = true;
        setRefreshing(true);
        setError('');
        try {
            const startedAt = performance.now();
            const response = await apiGet('/api/v1/security/monitoring', { signal });
            setLatencyMs(Math.round(performance.now() - startedAt));
            setMetrics(response.data);
            setLastChecked(Date.now());
            setLoading(false);
            const speedStartedAt = performance.now();
            const probe = await apiGet('/api/v1/security/speed-test', { signal });
            const durationMs = Math.max(performance.now() - speedStartedAt, 1);
            const mbps = (probe.payload.length * 8) / (durationMs * 1000);
            setSamples((current) => [...current, { at: Date.now(), mbps }].slice(-12));
        }
        catch (cause) {
            if (signal?.aborted)
                return;
            setError(cause instanceof Error
                ? cause.message
                : 'Monitoring data could not be refreshed. Check your connection and try again.');
            setLoading(false);
        }
        finally {
            if (!signal?.aborted) {
                refreshingRef.current = false;
                setRefreshing(false);
            }
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void refresh(controller.signal);
        const interval = window.setInterval(() => void refresh(controller.signal), 60_000);
        return () => {
            controller.abort();
            window.clearInterval(interval);
        };
    }, [refresh]);
    const totalReads = metrics.reduce((total, point) => total + point.reads, 0);
    const totalWrites = metrics.reduce((total, point) => total + point.writes, 0);
    const totalErrors = metrics.reduce((total, point) => total + point.errors, 0);
    const mostRecent = metrics[metrics.length - 1];
    const totalRequests = totalReads + totalWrites;
    const successRequests = Math.max(totalRequests - totalErrors, 0);
    const successRate = totalRequests > 0
        ? (successRequests / totalRequests) * 100
        : 100;
    const peakHour = useMemo(() => [...metrics].sort((a, b) => ((b.reads + b.writes) - (a.reads + a.writes)))[0], [metrics]);
    const latestSpeed = samples[samples.length - 1]?.mbps ?? null;
    const averageSpeed = samples.length
        ? samples.reduce((total, sample) => total + sample.mbps, 0) / samples.length
        : null;
    const healthTone = totalErrors > 0 || (latencyMs !== null && latencyMs >= 1200)
        ? 'warning'
        : 'good';
    const healthLabel = healthTone === 'warning' ? 'Needs attention' : 'Healthy';
    if (loading) {
        return (_jsxs("div", { className: "monitoring-loading", role: "status", children: [_jsx("span", { className: "monitoring-loading__pulse" }), "Loading account monitoring\u2026"] }));
    }
    return (_jsxs("div", { className: "monitoring-dashboard", children: [_jsxs("div", { className: "monitoring-dashboard__header", children: [_jsxs("div", { children: [_jsx("p", { className: "monitoring-dashboard__eyebrow", children: "Last 24 hours" }), _jsx("h2", { children: "Account security monitoring" })] }), _jsxs("button", { type: "button", className: "monitoring-refresh", onClick: () => void refresh(), disabled: refreshing, children: [_jsx(RefreshCw, { size: 15, className: refreshing ? 'is-spinning' : undefined, "aria-hidden": "true" }), refreshing ? 'Refreshing…' : 'Refresh'] })] }), error && (_jsxs("div", { className: "monitoring-alert", role: "alert", children: [_jsx(ShieldAlert, { size: 18, "aria-hidden": "true" }), _jsx("span", { children: error })] })), _jsxs("section", { className: "monitoring-metric-grid", "aria-label": "Account activity summary", children: [_jsx(MetricCard, { label: "Account status", value: healthLabel, detail: totalErrors === 0 ? 'No failed responses recorded' : `${totalErrors} failed response${totalErrors === 1 ? '' : 's'}`, icon: healthTone === 'good' ? _jsx(ShieldCheck, { size: 18 }) : _jsx(ShieldAlert, { size: 18 }), tone: healthTone }), _jsx(MetricCard, { label: "Requests \u00B7 24 hours", value: totalRequests.toLocaleString(), detail: "Read and write operations", icon: _jsx(Activity, { size: 18 }) }), _jsx(MetricCard, { label: "Success rate", value: `${successRate.toFixed(1)}%`, detail: `${successRequests.toLocaleString()} successful responses`, icon: _jsx(Zap, { size: 18 }), tone: successRate >= 99 ? 'good' : 'warning' }), _jsx(MetricCard, { label: "Response time", value: latencyMs === null ? '—' : `${latencyMs} ms`, detail: "API round-trip from this browser", icon: _jsx(Gauge, { size: 18 }), tone: latencyMs !== null && latencyMs < 1200 ? 'good' : 'warning' })] }), _jsxs("div", { className: "monitoring-content-grid", children: [_jsxs("section", { className: "monitoring-panel", "aria-labelledby": "request-chart-title", children: [_jsxs("div", { className: "monitoring-panel__header", children: [_jsxs("div", { children: [_jsx("p", { className: "monitoring-panel__eyebrow", children: "Hourly activity" }), _jsx("h3", { id: "request-chart-title", children: "API requests" })] }), _jsxs("div", { className: "monitoring-chart-legend", "aria-label": "Chart legend", children: [_jsx("span", { className: "monitoring-chart-legend__reads", children: "Reads" }), _jsx("span", { className: "monitoring-chart-legend__writes", children: "Writes" })] })] }), metrics.length > 0
                                ? _jsx(RequestChart, { metrics: metrics })
                                : _jsx("div", { className: "monitoring-chart-empty", children: "No activity recorded yet." })] }), _jsxs("aside", { className: "monitoring-side-column", children: [_jsxs("section", { className: "monitoring-panel monitoring-health-panel", "aria-labelledby": "health-chart-title", children: [_jsx("div", { className: "monitoring-panel__header", children: _jsxs("div", { children: [_jsx("p", { className: "monitoring-panel__eyebrow", children: "Response health" }), _jsx("h3", { id: "health-chart-title", children: "Success vs. errors" })] }) }), _jsxs("div", { className: "monitoring-donut-row", children: [_jsx("div", { className: "monitoring-donut", style: { '--success-rate': `${successRate * 3.6}deg` }, role: "img", "aria-label": `${successRate.toFixed(1)} percent of API responses were successful`, children: _jsxs("div", { children: [_jsxs("strong", { children: [successRate.toFixed(0), "%"] }), _jsx("span", { children: "success" })] }) }), _jsxs("dl", { className: "monitoring-health-list", children: [_jsxs("div", { children: [_jsx("dt", { children: "Successful" }), _jsx("dd", { children: successRequests.toLocaleString() })] }), _jsxs("div", { children: [_jsx("dt", { children: "Failed" }), _jsx("dd", { children: totalErrors.toLocaleString() })] })] })] })] }), _jsxs("section", { className: "monitoring-panel monitoring-peak-panel", "aria-labelledby": "peak-hour-title", children: [_jsx("p", { className: "monitoring-panel__eyebrow", id: "peak-hour-title", children: "Peak activity" }), _jsx("strong", { children: peakHour
                                            ? new Date(peakHour.hour).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })
                                            : '—' }), _jsx("span", { children: peakHour
                                            ? `${(peakHour.reads + peakHour.writes).toLocaleString()} requests in the busiest hour`
                                            : 'Waiting for activity' })] })] })] }), _jsxs("section", { className: "monitoring-panel monitoring-network-panel", "aria-labelledby": "connection-title", children: [_jsxs("div", { className: "monitoring-panel__header", children: [_jsxs("div", { children: [_jsx("p", { className: "monitoring-panel__eyebrow", children: "Browser connection" }), _jsx("h3", { id: "connection-title", children: "Network estimate" })] }), _jsx("span", { className: "monitoring-updated", children: lastChecked
                                    ? `Updated ${new Date(lastChecked).toLocaleTimeString()}`
                                    : 'Waiting for first check' })] }), _jsxs("div", { className: "monitoring-network-grid", children: [_jsxs("div", { className: "monitoring-network-stats", children: [_jsx(MetricCard, { label: "Latest estimate", value: latestSpeed === null ? '—' : `${latestSpeed.toFixed(2)} Mbps`, detail: "Approximate browser transfer", icon: _jsx(Wifi, { size: 18 }) }), _jsx(MetricCard, { label: "Average estimate", value: averageSpeed === null ? '—' : `${averageSpeed.toFixed(2)} Mbps`, detail: `Across ${samples.length} recent check${samples.length === 1 ? '' : 's'}`, icon: _jsx(Gauge, { size: 18 }) })] }), _jsx("div", { className: "monitoring-network-chart", children: _jsx(SpeedChart, { samples: samples }) })] }), _jsx("p", { className: "monitoring-estimate-note", children: "This is an illustrative browser-to-API transfer estimate, not a formal internet speed test. It transfers a small 128 KiB payload and can vary with browser, routing, CDN, and server load." })] }), _jsxs("p", { className: "monitoring-dashboard__footer", children: ["Activity refreshes every minute. The current hour includes", ' ', mostRecent ? (mostRecent.reads + mostRecent.writes).toLocaleString() : '0', " requests."] })] }));
}
