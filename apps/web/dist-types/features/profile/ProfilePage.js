import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CircleUserRound, LogOut, Mail, ShieldCheck } from 'lucide-react';
import Topbar from '../../components/ui/Topbar';
import { useAuthStore } from '../../state/auth-store';
import { useVaultStore } from '../../state/vault-store';
import { apiGet, apiPost } from '../../services/http-client';
import { getErrorMessage } from '../../services/error-handler';
import ChangePasswordForm from './components/ChangePasswordForm';
import AccountDeletionSection from './components/AccountDeletionSection';
import './profile.css';
export default function ProfilePage() {
    const navigate = useNavigate();
    const clearCsrfToken = useAuthStore((state) => state.clearCsrfToken);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setLoadError('');
        apiGet('/api/v1/users/me', { signal: controller.signal })
            .then((response) => setProfile(response.data))
            .catch((cause) => {
            if (!controller.signal.aborted)
                setLoadError(getErrorMessage(cause));
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [retryCount]);
    async function handleLogout() {
        setLoggingOut(true);
        setLogoutError('');
        try {
            await apiPost('/api/v1/auth/logout');
            clearCsrfToken();
            useVaultStore.getState().lockVault();
            navigate('/login', { replace: true });
        }
        catch (cause) {
            setLogoutError(getErrorMessage(cause));
            setLoggingOut(false);
        }
    }
    return (_jsxs("div", { className: "profile-page", children: [_jsx(Topbar, { breadcrumbs: [{ label: 'Profile', href: '/app/profile' }], showSearch: false }), _jsxs("div", { className: "profile-content", children: [_jsxs("header", { className: "profile-page-heading", children: [_jsx("span", { className: "profile-page-heading__icon", children: _jsx(CircleUserRound, { size: 22, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("p", { className: "profile-eyebrow", children: "Account settings" }), _jsx("h1", { children: "Your profile" }), _jsx("p", { children: "Manage your sign-in details and account access." })] })] }), _jsxs("section", { className: "profile-card", "aria-labelledby": "profile-details-title", children: [_jsxs("div", { className: "profile-card-heading", children: [_jsx("div", { className: "profile-card-heading__icon", children: _jsx(CircleUserRound, { size: 18, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h2", { id: "profile-details-title", children: "Profile details" }), _jsx("p", { children: "Your Vaultnary account information." })] })] }), loading ? (_jsx("p", { className: "profile-muted", role: "status", children: "Loading your profile\u2026" })) : loadError ? (_jsxs("div", { children: [_jsx("p", { className: "profile-alert", role: "alert", children: loadError }), _jsx("button", { className: "profile-secondary-button", type: "button", onClick: () => setRetryCount((count) => count + 1), children: "Try again" })] })) : profile ? (_jsxs("dl", { className: "profile-details-list", children: [_jsxs("div", { children: [_jsxs("dt", { children: [_jsx(Mail, { size: 15, "aria-hidden": "true" }), " Email address"] }), _jsx("dd", { children: profile.email })] }), _jsxs("div", { children: [_jsxs("dt", { children: [_jsx(ShieldCheck, { size: 15, "aria-hidden": "true" }), " Email status"] }), _jsx("dd", { className: profile.email_verified ? 'profile-verified' : 'profile-unverified', children: profile.email_verified ? _jsxs(_Fragment, { children: [_jsx(BadgeCheck, { size: 15, "aria-hidden": "true" }), " Verified"] }) : 'Not verified' })] })] })) : null] }), _jsxs("section", { className: "profile-card", "aria-labelledby": "profile-password-title", children: [_jsxs("div", { className: "profile-card-heading", children: [_jsx("div", { className: "profile-card-heading__icon", children: _jsx(ShieldCheck, { size: 18, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h2", { id: "profile-password-title", children: "Password and security" }), _jsx("p", { children: "Choose a strong, unique password to protect your account." })] })] }), _jsx(ChangePasswordForm, {})] }), _jsxs("section", { className: "profile-card profile-logout-card", "aria-labelledby": "profile-logout-title", children: [_jsxs("div", { className: "profile-card-heading", children: [_jsx("div", { className: "profile-card-heading__icon", children: _jsx(LogOut, { size: 18, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h2", { id: "profile-logout-title", children: "Sign out" }), _jsx("p", { children: "End this session on this device. Your vault will be locked." })] })] }), logoutError && _jsx("p", { className: "profile-alert", role: "alert", children: logoutError }), _jsxs("button", { className: "profile-logout-button", type: "button", onClick: () => void handleLogout(), disabled: loggingOut, children: [_jsx(LogOut, { size: 16, "aria-hidden": "true" }), loggingOut ? 'Signing out…' : 'Sign out'] })] }), _jsx(AccountDeletionSection, {})] })] }));
}
