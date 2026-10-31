import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../../services/http-client';
import { isValidEmail, isValidPassword } from '../../services/validation';
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler';
export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [globalError, setGlobalError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    function validate() {
        const errs = {};
        if (!isValidEmail(email))
            errs.email = 'Enter a valid email address.';
        if (!isValidPassword(password))
            errs.password = 'Password must be 12–128 characters.';
        if (password !== confirm)
            errs.confirm = 'Passwords do not match.';
        return errs;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setGlobalError('');
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            return;
        }
        setFieldErrors({});
        setLoading(true);
        try {
            await apiPost('/api/v1/auth/register', { email, password });
            setSuccess(true);
        }
        catch (err) {
            if (err instanceof ValidationError) {
                const mapped = {};
                for (const fe of err.fieldErrors)
                    mapped[fe.field] = fe.rule;
                setFieldErrors(mapped);
            }
            else if (err instanceof RateLimitError) {
                setGlobalError('Too many attempts. Please try again later.');
            }
            else {
                setGlobalError(getErrorMessage(err));
            }
        }
        finally {
            setLoading(false);
        }
    }
    if (success) {
        return (_jsx("div", { style: pageStyle, children: _jsxs("div", { style: cardStyle, children: [_jsx("h1", { style: headingStyle, children: "Check your email" }), _jsx("p", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }, children: "If an account was created, a verification link has been sent to your email address." }), _jsx(Link, { to: "/login", style: { color: 'var(--color-accent)', fontSize: 'var(--text-sm)', textAlign: 'center' }, children: "Back to sign in" })] }) }));
    }
    return (_jsx("div", { style: pageStyle, children: _jsxs("form", { onSubmit: handleSubmit, noValidate: true, "aria-label": "Create account", style: cardStyle, children: [_jsx("h1", { style: headingStyle, children: "Create account" }), globalError && _jsx("p", { role: "alert", style: errorStyle, children: globalError }), ['email', 'password', 'confirm'].map((field) => (_jsxs("div", { style: fieldGroup, children: [_jsx("label", { htmlFor: field, style: labelStyle, children: field === 'confirm' ? 'Confirm password' : field.charAt(0).toUpperCase() + field.slice(1) }), _jsx("input", { id: field, type: field === 'email' ? 'email' : 'password', autoComplete: field === 'email' ? 'email' : field === 'password' ? 'new-password' : 'new-password', value: field === 'email' ? email : field === 'password' ? password : confirm, onChange: (e) => {
                                if (field === 'email')
                                    setEmail(e.target.value);
                                else if (field === 'password')
                                    setPassword(e.target.value);
                                else
                                    setConfirm(e.target.value);
                            }, "aria-describedby": fieldErrors[field] ? `${field}-error` : undefined, "aria-invalid": !!fieldErrors[field], style: inputStyle, disabled: loading }), fieldErrors[field] && (_jsx("span", { id: `${field}-error`, role: "alert", style: fieldErrorStyle, children: fieldErrors[field] }))] }, field))), _jsx("button", { type: "submit", disabled: loading, style: submitStyle, children: loading ? 'Creating account…' : 'Create account' }), _jsxs("p", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }, children: ["Already have an account? ", _jsx(Link, { to: "/login", style: { color: 'var(--color-accent)' }, children: "Sign in" })] })] }) }));
}
const pageStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)' };
const cardStyle = { width: '100%', maxWidth: '24rem', backgroundColor: 'var(--color-bg)', border: 'var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };
const headingStyle = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' };
const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' };
const labelStyle = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' };
const inputStyle = { padding: 'var(--space-2) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-base)', width: '100%' };
const submitStyle = { padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-base)', cursor: 'pointer', width: '100%' };
const errorStyle = { padding: 'var(--space-2) var(--space-3)', backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)' };
const fieldErrorStyle = { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' };
