import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/utilities.css';
import App from './App';
const rootEl = document.getElementById('root');
if (!rootEl)
    throw new Error('Root element #root not found');
createRoot(rootEl).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
