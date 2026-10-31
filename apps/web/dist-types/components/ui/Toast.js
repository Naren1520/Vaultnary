import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
const ToastContext = createContext(null);
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}
let nextId = 0;
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);
    const showToast = useCallback(({ message, type = 'info', duration = 3000 }) => {
        const id = ++nextId;
        setToasts((prev) => [...prev, { id, message, type }]);
        const timer = setTimeout(() => removeToast(id), duration);
        timers.current.set(id, timer);
    }, [removeToast]);
    return (_jsxs(ToastContext.Provider, { value: { showToast }, children: [children, _jsx(ToastContainer, { toasts: toasts, onClose: removeToast })] }));
}
function ToastContainer({ toasts, onClose, }) {
    if (toasts.length === 0)
        return null;
    return (_jsx("div", { "aria-live": "polite", "aria-atomic": "false", style: {
            position: 'fixed',
            bottom: 'var(--space-6)',
            right: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            zIndex: 'var(--z-toast)',
            maxWidth: '22rem',
            width: '100%',
        }, children: toasts.map((toast) => (_jsx(ToastItem, { toast: toast, onClose: onClose }, toast.id))) }));
}
function ToastItem({ toast, onClose }) {
    const iconMap = {
        success: _jsx(CheckCircle, { size: 16, "aria-hidden": "true", style: { color: 'var(--color-success)' } }),
        error: _jsx(AlertCircle, { size: 16, "aria-hidden": "true", style: { color: 'var(--color-danger)' } }),
        info: _jsx(Info, { size: 16, "aria-hidden": "true", style: { color: 'var(--color-accent)' } }),
    };
    return (_jsxs("div", { role: "status", style: {
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg)',
            border: 'var(--border-card)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text)',
        }, children: [iconMap[toast.type], _jsx("span", { style: { flex: 1 }, children: toast.message }), _jsx("button", { onClick: () => onClose(toast.id), "aria-label": "Dismiss notification", style: { color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }, children: _jsx(X, { size: 14, "aria-hidden": "true" }) })] }));
}
