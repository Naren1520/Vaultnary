import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { apiGet } from '../../services/http-client';
function MetricCard({ label, value, detail }) {
    return (_jsxs("article", { className: "app-page-section", style: { minWidth: 0 }, children: [_jsx("p", { style: { margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: label }), _jsx("strong", { style: { display: 'block', marginTop: 'var(--space-2)', fontSize: 'clamp(1.35rem, 3vw, 1.8rem)', letterSpacing: '-0.04em' }, children: value }), _jsx("p", { style: { margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: detail })] }));
}
function RequestChart({ metrics }) {
    const max = Math.max(1, ...metrics.map((point) => point.reads + point.writes));
    const chartHeight = 142;
    const barWidth = 14;
    const chartWidth = 720;
    const gap = (chartWidth - metrics.length * barWidth) / Math.max(metrics.length - 1, 1);
    return (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("svg", { viewBox: "0 0 720 190", role: "img", "aria-label": "Hourly API reads and writes over the last 24 hours", style: { display: 'block', width: '100%', minWidth: '34rem', height: 'auto' }, children: [[0, 1, 2, 3].map((line) => {
                    const y = 16 + line * (chartHeight / 3);
                    return _jsx("line", { x1: "0", x2: "720", y1: y, y2: y, stroke: "#e8ebf0", strokeDasharray: "3 5" }, line);
                }), metrics.map((point, index) => {
                    const x = index * (barWidth + gap);
                    const readHeight = (point.reads / max) * chartHeight;
                    const writeHeight = (point.writes / max) * chartHeight;
                    const title = `${new Date(point.hour).toLocaleString()}: ${point.reads} reads, ${point.writes} writes, ${point.errors} errors`;
                    return (_jsxs("g", { children: [_jsx("title", { children: title }), _jsx("rect", { x: x, y: 16 + chartHeight - readHeight - writeHeight, width: barWidth, height: writeHeight, rx: "3", fill: "#6c8ff0" }), _jsx("rect", { x: x, y: 16 + chartHeight - readHeight, width: barWidth, height: readHeight, rx: "3", fill: "#23a58b" })] }, point.hour));
                }), _jsx("text", { x: "0", y: "181", fill: "#6b7280", fontSize: "11", children: "24 hours ago" }), _jsx("text", { x: "670", y: "181", fill: "#6b7280", fontSize: "11", children: "Now" })] }) }));
}
function SpeedChart({ samples }) {
    if (samples.length < 2) {
        return _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: "Speed history will appear after the next periodic check." });
    }
    const max = Math.max(0.1, ...samples.map((sample) => sample.mbps));
    const points = samples.map((sample, index) => {
        const x = 8 + (index / (samples.length - 1)) * 684;
        const y = 90 - (sample.mbps / max) * 72;
        return `${x},${y}`;
    }).join(' ');
    return (_jsxs("svg", { viewBox: "0 0 700 110", role: "img", "aria-label": "Estimated download speed from recent checks", style: { display: 'block', width: '100%', height: 'auto' }, children: [_jsx("line", { x1: "8", x2: "692", y1: "90", y2: "90", stroke: "#e8ebf0" }), _jsx("polyline", { points: points, fill: "none", stroke: "#376de5", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" }), samples.map((sample, index) => {
                const x = 8 + (index / (samples.length - 1)) * 684;
                const y = 90 - (sample.mbps / max) * 72;
                return _jsx("circle", { cx: x, cy: y, r: "3.5", fill: "#376de5", children: _jsxs("title", { children: [sample.mbps.toFixed(2), " Mbps"] }) }, sample.at);
            })] }));
}
export default function MonitoringPanel() {
    const [metrics, setMetrics] = useState([]);
    const [samples, setSamples] = useState([]);
    const [latencyMs, setLatencyMs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastChecked, setLastChecked] = useState(null);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        let refreshing = false;
        async function refresh() {
            if (refreshing)
                return;
            refreshing = true;
            setError('');
            try {
                const startedAt = performance.now();
                const response = await apiGet('/api/v1/security/monitoring', { signal: controller.signal });
                if (!active)
                    return;
                setLatencyMs(Math.round(performance.now() - startedAt));
                setMetrics(response.data);
                setLastChecked(Date.now());
                setLoading(false);
                const speedStartedAt = performance.now();
                const probe = await apiGet('/api/v1/security/speed-test', { signal: controller.signal });
                if (!active)
                    return;
                const durationMs = Math.max(performance.now() - speedStartedAt, 1);
                const mbps = (probe.payload.length * 8) / (durationMs * 1000);
                setSamples((current) => [...current, { at: Date.now(), mbps }].slice(-12));
            }
            catch {
                if (!active)
                    return;
                setError('Monitoring data could not be refreshed. Check your connection and try again.');
                setLoading(false);
            }
            finally {
                refreshing = false;
            }
        }
        void refresh();
        const interval = window.setInterval(() => void refresh(), 60_000);
        return () => {
            active = false;
            controller.abort();
            window.clearInterval(interval);
        };
    }, []);
    const totalReads = metrics.reduce((total, point) => total + point.reads, 0);
    const totalWrites = metrics.reduce((total, point) => total + point.writes, 0);
    const totalErrors = metrics.reduce((total, point) => total + point.errors, 0);
    const mostRecent = metrics[metrics.length - 1];
    if (loading) {
        return _jsx("p", { role: "status", style: { color: 'var(--color-text-muted)' }, children: "Loading account monitoring\u2026" });
    }
    return (_jsxs("div", { style: { display: 'grid', gap: 'var(--space-4)' }, children: [error && _jsx("p", { role: "alert", style: { color: 'var(--color-danger)' }, children: error }), _jsxs("section", { "aria-label": "API activity", style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))', gap: 'var(--space-3)' }, children: [_jsx(MetricCard, { label: "Requests \u00B7 24 hours", value: (totalReads + totalWrites).toLocaleString(), detail: "Across all your signed-in devices" }), _jsx(MetricCard, { label: "Read requests", value: totalReads.toLocaleString(), detail: "Data requests to your account" }), _jsx(MetricCard, { label: "Write requests", value: totalWrites.toLocaleString(), detail: "Changes sent to your account" }), _jsx(MetricCard, { label: "Failed requests", value: totalErrors.toLocaleString(), detail: "Responses with an error status" })] }), _jsxs("section", { className: "app-page-section", "aria-labelledby": "request-chart-title", children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }, children: [_jsxs("div", { children: [_jsx("h2", { id: "request-chart-title", style: { margin: 0, fontSize: 'var(--text-lg)' }, children: "API activity" }), _jsx("p", { style: { margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: "Hourly requests received and changes sent, across your account." })] }), _jsxs("div", { style: { display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }, children: [_jsx("span", { style: { color: '#168b75' }, children: "\u25CF Reads" }), _jsx("span", { style: { color: '#5277d5' }, children: "\u25CF Writes" })] })] }), metrics.length > 0
                        ? _jsx(RequestChart, { metrics: metrics })
                        : _jsx("p", { style: { color: 'var(--color-text-muted)' }, children: "No activity recorded yet." })] }), _jsxs("section", { className: "app-page-section", "aria-labelledby": "connection-title", children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', flexWrap: 'wrap' }, children: [_jsxs("div", { children: [_jsx("h2", { id: "connection-title", style: { margin: 0, fontSize: 'var(--text-lg)' }, children: "Connection to Vaultnary" }), _jsx("p", { style: { margin: 'var(--space-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }, children: "Periodic checks while this dashboard is open; each speed check transfers about 128 KiB." })] }), _jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: lastChecked ? `Updated ${new Date(lastChecked).toLocaleTimeString()}` : 'Waiting for first check' })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }, children: [_jsx(MetricCard, { label: "Response time", value: latencyMs === null ? '—' : `${latencyMs} ms`, detail: "Round trip to the API" }), _jsx(MetricCard, { label: "Download estimate", value: samples.length ? `${samples[samples.length - 1].mbps.toFixed(2)} Mbps` : '—', detail: "Browser-to-API transfer estimate" })] }), _jsx("div", { style: { marginTop: 'var(--space-3)' }, children: _jsx(SpeedChart, { samples: samples }) })] }), _jsxs("p", { style: { margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }, children: ["Request activity refreshes every minute. The current hour includes ", mostRecent ? (mostRecent.reads + mostRecent.writes).toLocaleString() : '0', " requests so far."] })] }));
}
