import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../state/auth-store';
import { apiPost } from '../../services/http-client';
import { isValidEmail, isValidPassword } from '../../services/validation';
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler';
export default function LoginPage() {
    const navigate = useNavigate();
    const setCsrfToken = useAuthStore((s) => s.setCsrfToken);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [globalError, setGlobalError] = useState('');
    const [rateLimitMsg, setRateLimitMsg] = useState('');
    const [loading, setLoading] = useState(false);
    function validate() {
        const errs = {};
        if (!isValidEmail(email))
            errs.email = 'Enter a valid email address.';
        if (!isValidPassword(password))
            errs.password = 'Password must be 12–128 characters.';
        return errs;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setGlobalError('');
        setRateLimitMsg('');
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            return;
        }
        setFieldErrors({});
        setLoading(true);
        try {
            const res = await apiPost('/api/v1/auth/login', {
                email,
                password,
            });
            setCsrfToken(res.csrf_token);
            navigate('/app/vault', { replace: true });
        }
        catch (err) {
            if (err instanceof ValidationError) {
                const mapped = {};
                for (const fe of err.fieldErrors)
                    mapped[fe.field] = fe.rule;
                setFieldErrors(mapped);
            }
            else if (err instanceof RateLimitError) {
                const secs = err.retryAfterSeconds;
                setRateLimitMsg(secs ? `Too many attempts. Try again in ${secs}s.` : 'Too many attempts. Try again later.');
            }
            else {
                setGlobalError(getErrorMessage(err));
            }
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { style: pageStyle, children: _jsxs("form", { onSubmit: handleSubmit, noValidate: true, "aria-label": "Sign in", style: cardStyle, children: [_jsx("h1", { style: headingStyle, children: "Sign in" }), globalError && (_jsx("p", { role: "alert", style: errorStyle, children: globalError })), rateLimitMsg && (_jsx("p", { role: "alert", style: rateLimitStyle, children: rateLimitMsg })), _jsxs("div", { style: fieldGroup, children: [_jsx("label", { htmlFor: "email", style: labelStyle, children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), "aria-describedby": fieldErrors.email ? 'email-error' : undefined, "aria-invalid": !!fieldErrors.email, style: inputStyle, disabled: loading }), fieldErrors.email && (_jsx("span", { id: "email-error", role: "alert", style: fieldErrorStyle, children: fieldErrors.email }))] }), _jsxs("div", { style: fieldGroup, children: [_jsx("label", { htmlFor: "password", style: labelStyle, children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), "aria-describedby": fieldErrors.password ? 'password-error' : undefined, "aria-invalid": !!fieldErrors.password, style: inputStyle, disabled: loading }), fieldErrors.password && (_jsx("span", { id: "password-error", role: "alert", style: fieldErrorStyle, children: fieldErrors.password }))] }), _jsx("button", { type: "submit", disabled: loading, style: submitStyle, children: loading ? 'Signing in…' : 'Sign in' }), _jsxs("p", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-3)' }, children: ["No account?", ' ', _jsx(Link, { to: "/register", style: { color: 'var(--color-accent)' }, children: "Register" })] }), _jsx("p", { style: { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }, children: _jsx(Link, { to: "/forgot-password", style: { color: 'var(--color-accent)' }, children: "Forgot password?" }) })] }) }));
}
const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-bg-subtle)',
    padding: 'var(--space-4)',
};
const cardStyle = {
    width: '100%',
    maxWidth: '24rem',
    backgroundColor: 'var(--color-bg)',
    border: 'var(--border-card)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
};
const headingStyle = {
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--font-weight-semibold)',
    textAlign: 'center',
};
const fieldGroup = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' };
const labelStyle = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' };
const inputStyle = {
    padding: 'var(--space-2) var(--space-3)',
    border: 'var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-base)',
    width: '100%',
};
const submitStyle = {
    padding: 'var(--space-2) var(--space-4)',
    backgroundColor: 'var(--color-accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--font-weight-medium)',
    fontSize: 'var(--text-base)',
    cursor: 'pointer',
    width: '100%',
};
const errorStyle = {
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'rgba(220,38,38,0.08)',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-danger)',
    fontSize: 'var(--text-sm)',
};
const rateLimitStyle = { ...errorStyle, borderColor: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' };
const fieldErrorStyle = { fontSize: 'var(--text-xs)', color: 'var(--color-danger)' };
