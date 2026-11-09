import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import AuthPageLayout from './AuthPageLayout';
import { useAuthStore } from '../../state/auth-store';
import { apiPost } from '../../services/http-client';
import { isValidEmail, isValidPassword } from '../../services/validation';
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler';
import './auth.css';
export default function LoginPage() {
    const navigate = useNavigate();
    const setCsrfToken = useAuthStore((s) => s.setCsrfToken);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
    return (_jsx(AuthPageLayout, { children: _jsxs("form", { onSubmit: handleSubmit, noValidate: true, "aria-label": "Sign in", "aria-labelledby": "auth-login-title", className: "auth-login__form", children: [_jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "SECURE WORKSPACE ACCESS" }), _jsx("h2", { id: "auth-login-title", children: "Welcome back" }), _jsx("p", { children: "Sign in to continue to your Vaultnary workspace." })] }), globalError && _jsx("p", { role: "alert", className: "auth-login__alert", children: globalError }), rateLimitMsg && _jsx("p", { role: "alert", className: "auth-login__alert auth-login__alert--muted", children: rateLimitMsg }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "email", children: "Email address" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", placeholder: "you@company.com", value: email, onChange: (e) => setEmail(e.target.value), "aria-describedby": fieldErrors.email ? 'email-error' : undefined, "aria-invalid": !!fieldErrors.email, disabled: loading }), fieldErrors.email && _jsx("span", { id: "email-error", role: "alert", className: "auth-login__field-error", children: fieldErrors.email })] }), _jsxs("div", { className: "auth-login__field", children: [_jsxs("div", { className: "auth-login__label-row", children: [_jsx("label", { htmlFor: "password", children: "Password" }), _jsx(Link, { to: "/forgot-password", children: "Forgot password?" })] }), _jsxs("div", { className: "auth-login__password-wrap", children: [_jsx("input", { id: "password", type: showPassword ? 'text' : 'password', autoComplete: "current-password", placeholder: "Enter your password", value: password, onChange: (e) => setPassword(e.target.value), "aria-describedby": fieldErrors.password ? 'password-error' : undefined, "aria-invalid": !!fieldErrors.password, disabled: loading }), _jsx("button", { className: "auth-login__password-toggle", type: "button", onClick: () => setShowPassword((visible) => !visible), "aria-label": showPassword ? 'Hide password' : 'Show password', "aria-pressed": showPassword, disabled: loading, children: showPassword ? _jsx(EyeOff, { size: 17 }) : _jsx(Eye, { size: 17 }) })] }), fieldErrors.password && _jsx("span", { id: "password-error", role: "alert", className: "auth-login__field-error", children: fieldErrors.password })] }), _jsxs("button", { type: "submit", disabled: loading, className: "auth-login__submit", children: [_jsx("span", { children: loading ? 'Signing in…' : 'Sign in securely' }), _jsx(ArrowRight, { size: 17, "aria-hidden": "true" })] }), _jsxs("div", { className: "auth-login__form-assurance", children: [_jsx(ShieldCheck, { size: 15 }), _jsx("span", { children: "Your credentials are protected in transit." })] }), _jsxs("p", { className: "auth-login__register", children: ["New to Vaultnary? ", _jsxs(Link, { to: "/register", children: ["Create an account ", _jsx(ArrowRight, { size: 14 })] })] })] }) }));
}
