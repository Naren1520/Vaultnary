import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const LOADER_STYLES = `
  .loader-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .loader-container {
    overflow: visible;
  }
  .loader-shield-track {
    fill: none;
    stroke: #d0d0d0;
    stroke-width: 2.5;
  }
  .loader-shield {
    fill: none;
    stroke: #111;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-dasharray: 30 70;
    animation: loader-shield-move 2s linear infinite;
  }
  .loader-lock-body {
    fill: #111;
    animation: loader-lock-pulse 1.5s ease-in-out infinite;
    transform-origin: center;
  }
  .loader-lock {
    fill: none;
    stroke: #666;
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .loader-keyhole {
    fill: #fff;
    animation: loader-key-pulse 1.5s ease-in-out infinite;
  }
  .loader-keyhole-line {
    stroke: #fff;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .loader-scan {
    stroke: #555;
    stroke-width: 1.5;
    stroke-linecap: round;
    opacity: 0;
    animation: loader-scan 1.8s ease-in-out infinite;
  }
  @keyframes loader-shield-move {
    from { stroke-dashoffset: 100; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes loader-lock-pulse {
    0%, 100% { opacity: 0.65; transform: scale(1); }
    50%       { opacity: 1;    transform: scale(1.08); }
  }
  @keyframes loader-key-pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes loader-scan {
    0%   { opacity: 0; transform: translateY(-5px); }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(35px); }
  }
`;
let stylesInjected = false;
function injectStyles() {
    if (stylesInjected)
        return;
    const tag = document.createElement('style');
    tag.textContent = LOADER_STYLES;
    document.head.appendChild(tag);
    stylesInjected = true;
}
export default function Loader({ size = 100 }) {
    injectStyles();
    return (_jsx("div", { className: "loader-wrap", role: "status", "aria-label": "Loading", children: _jsxs("svg", { className: "loader-container", width: size, height: size, viewBox: "0 0 64 64", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: [_jsx("path", { className: "loader-shield-track", d: "M32 4L52 12V28C52 42 44 52 32 59C20 52 12 42 12 28V12L32 4Z" }), _jsx("path", { className: "loader-shield", pathLength: 100, d: "M32 4L52 12V28C52 42 44 52 32 59C20 52 12 42 12 28V12L32 4Z" }), _jsx("rect", { className: "loader-lock-body", x: 23, y: 28, width: 18, height: 15, rx: 3 }), _jsx("path", { className: "loader-lock", d: "M27 28V23C27 20.2 29.2 18 32 18C34.8 18 37 20.2 37 23V28" }), _jsx("circle", { className: "loader-keyhole", cx: 32, cy: 34, r: 2 }), _jsx("path", { className: "loader-keyhole-line", d: "M32 36V39" }), _jsx("line", { className: "loader-scan", x1: 16, y1: 16, x2: 48, y2: 16 })] }) }));
}
