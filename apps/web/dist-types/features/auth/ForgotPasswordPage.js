import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../../services/http-client';
import { isValidEmail } from '../../services/validation';
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        if (!isValidEmail(email)) {
            setEmailError('Enter a valid email address.');
            return;
        }
        setEmailError('');
        setLoading(true);
        try {
            await apiPost('/api/v1/auth/forgot-password', { email });
        }
        catch {
            // Always show the same message regardless of outcome (no account enumeration)
        }
        finally {
            setLoading(false);
            setSubmitted(true);
        }
    }
    return (_jsx("div", { style: pageStyle, children: _jsxs("div", { style: cardStyle, children: [_jsx("h1", { style: headingStyle, children: "Reset password" }), submitted ? (_jsxs(_Fragment, { children: [_jsx("p", { style: mutedStyle, children: "If an account exists for that address, a reset link has been sent." }), _jsx(Link, { to: "/login", style: linkStyle, children: "Back to sign in" })] })) : (_jsxs("form", { onSubmit: handleSubmit, noValidate: true, style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }, children: [_jsxs("div", { style: fieldGroup, children: [_jsx("label", { htmlFor: "email", style: labelStyle, children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), "aria-describedby": emailError ? 'email-error' : undefined, "aria-invalid": !!emailError, style: inputStyle, disabled: loading }), emailError && _jsx("span", { id: "email-error", role: "alert", style: fieldErrorStyle, children: emailError })] }), _jsx("button", { type: "submit", disabled: loading, style: submitStyle, children: loading ? 'Sending…' : 'Send reset link' }), _jsx(Link, { to: "/login", style: { ...linkStyle, textAlign: 'center' }, children: "Back to sign in" })] }))] }) }));
}
const pageStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)' };
const cardStyle = { width: '100%', maxWidth: '24rem', backgroundColor: 'var(--color-bg)', border: 'var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };
const headingStyle = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' };
const mutedStyle = { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' };
const linkStyle = { color: 'var(--color-accent)', fontSize: 'var(--text-sm)' };
const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' };
const labelStyle = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' };
const inputStyle = { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-base)', width: '100%' };
const submitStyle = { padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-base)', cursor: 'pointer', width: '100%' };
const fieldErrorStyle = { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' };
