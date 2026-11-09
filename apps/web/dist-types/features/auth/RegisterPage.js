import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, UserRoundPlus } from 'lucide-react';
import { apiPost } from '../../services/http-client';
import { isValidEmail, isValidPassword } from '../../services/validation';
import { ValidationError, RateLimitError, getErrorMessage } from '../../services/error-handler';
import AuthPageLayout from './AuthPageLayout';
import './auth.css';
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
    return (_jsx(AuthPageLayout, { children: success ? (_jsxs("div", { className: "auth-login__form", "aria-labelledby": "register-success-title", children: [_jsx("div", { className: "auth-login__status-icon", children: _jsx(Check, { size: 23 }) }), _jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "ONE MORE STEP" }), _jsx("h2", { id: "register-success-title", children: "Check your email" }), _jsx("p", { children: "If an account was created, a verification link has been sent to your email address." })] }), _jsxs(Link, { to: "/login", className: "auth-login__submit auth-login__submit--link", children: [_jsx("span", { children: "Back to sign in" }), _jsx(ArrowRight, { size: 17 })] })] })) : (_jsxs("form", { onSubmit: handleSubmit, noValidate: true, "aria-label": "Create account", className: "auth-login__form", children: [_jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "CREATE YOUR SECURE WORKSPACE" }), _jsx("h2", { children: "Create account" }), _jsx("p", { children: "Set up your account to start organizing team access." })] }), globalError && _jsx("p", { role: "alert", className: "auth-login__alert", children: globalError }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "email", children: "Email address" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", placeholder: "you@company.com", value: email, onChange: (e) => setEmail(e.target.value), "aria-describedby": fieldErrors.email ? 'email-error' : undefined, "aria-invalid": !!fieldErrors.email, disabled: loading }), fieldErrors.email && _jsx("span", { id: "email-error", role: "alert", className: "auth-login__field-error", children: fieldErrors.email })] }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "new-password", placeholder: "At least 12 characters", value: password, onChange: (e) => setPassword(e.target.value), "aria-describedby": fieldErrors.password ? 'password-hint password-error' : 'password-hint', "aria-invalid": !!fieldErrors.password, disabled: loading }), _jsx("span", { id: "password-hint", className: "auth-login__field-hint", children: "Use 12\u2013128 characters." }), fieldErrors.password && _jsx("span", { id: "password-error", role: "alert", className: "auth-login__field-error", children: fieldErrors.password })] }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "confirm", children: "Confirm password" }), _jsx("input", { id: "confirm", type: "password", autoComplete: "new-password", placeholder: "Re-enter your password", value: confirm, onChange: (e) => setConfirm(e.target.value), "aria-describedby": fieldErrors.confirm ? 'confirm-error' : undefined, "aria-invalid": !!fieldErrors.confirm, disabled: loading }), fieldErrors.confirm && _jsx("span", { id: "confirm-error", role: "alert", className: "auth-login__field-error", children: fieldErrors.confirm })] }), _jsxs("button", { type: "submit", disabled: loading, className: "auth-login__submit", children: [_jsx("span", { children: loading ? 'Creating account…' : 'Create secure account' }), _jsx(UserRoundPlus, { size: 17, "aria-hidden": "true" })] }), _jsxs("p", { className: "auth-login__legal", children: ["By creating an account, you acknowledge the ", _jsx(Link, { to: "/terms", children: "Terms" }), " and ", _jsx(Link, { to: "/privacy", children: "Privacy Notice" }), "."] }), _jsxs("p", { className: "auth-login__register", children: ["Already have an account? ", _jsxs(Link, { to: "/login", children: ["Sign in ", _jsx(ArrowRight, { size: 14 })] })] })] })) }));
}
