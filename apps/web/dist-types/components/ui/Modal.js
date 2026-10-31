import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
/**
 * Accessible modal dialog.
 * - Focus is trapped inside while open
 * - Closes on Escape key
 * - No action occurs without explicit user confirmation
 */
export default function Modal({ open, title, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onClose, children, destructive = false, }) {
    const dialogRef = useRef(null);
    const previousFocusRef = useRef(null);
    // Focus trap and Escape key handler
    useEffect(() => {
        if (!open)
            return;
        previousFocusRef.current = document.activeElement;
        // Focus the dialog
        const dialog = dialogRef.current;
        if (dialog) {
            const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            focusable[0]?.focus();
        }
        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'Tab') {
                const dialog = dialogRef.current;
                if (!dialog)
                    return;
                const focusable = Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
                if (focusable.length === 0)
                    return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                }
                else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [open, onClose]);
    if (!open)
        return null;
    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget)
            onClose();
    }, [onClose]);
    return (_jsx("div", { role: "presentation", onClick: handleBackdropClick, style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal)',
            padding: 'var(--space-4)',
        }, children: _jsxs("div", { ref: dialogRef, role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title", style: {
                backgroundColor: 'var(--color-bg)',
                border: 'var(--border-card)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                width: '100%',
                maxWidth: '28rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("h2", { id: "modal-title", style: {
                                fontSize: 'var(--text-lg)',
                                fontWeight: 'var(--font-weight-semibold)',
                                color: 'var(--color-text)',
                            }, children: title }), _jsx("button", { onClick: onClose, "aria-label": "Close dialog", style: { color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }, children: _jsx(X, { size: 16, "aria-hidden": "true" }) })] }), children && (_jsx("div", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text)' }, children: children })), onConfirm && (_jsxs("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }, children: [_jsx("button", { onClick: onClose, style: {
                                padding: 'var(--space-2) var(--space-4)',
                                border: 'var(--border-input)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--color-text)',
                                backgroundColor: 'var(--color-bg)',
                            }, children: cancelLabel }), _jsx("button", { onClick: onConfirm, style: {
                                padding: 'var(--space-2) var(--space-4)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--font-weight-medium)',
                                color: '#fff',
                                backgroundColor: destructive ? 'var(--color-danger)' : 'var(--color-accent)',
                            }, children: confirmLabel })] }))] }) }));
}
