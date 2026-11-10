import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Mail, MessageSquareText, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiPost } from '../../services/http-client';
import PublicSiteLayout from '../legal/PublicSiteLayout';
import { CONTACT_EMAIL } from './constants';
import './company.css';
export default function ContactPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    async function handleSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        setIsSubmitting(true);
        setSubmitted(false);
        setError('');
        const formData = new FormData(event.currentTarget);
        const contactForm = {
            name: String(formData.get('name') ?? ''),
            email: String(formData.get('email') ?? ''),
            topic: String(formData.get('topic') ?? ''),
            message: String(formData.get('message') ?? ''),
        };
        try {
            await apiPost('/api/v1/contact', contactForm);
            setSubmitted(true);
            form.reset();
        }
        catch {
            setError('We couldn’t send your message. Please try again or email us directly.');
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsx(PublicSiteLayout, { children: _jsxs("div", { className: "company-page", children: [_jsx("section", { className: "company-hero", children: _jsxs("div", { className: "public-container company-contact-hero", children: [_jsxs("div", { children: [_jsx("p", { className: "legal-eyebrow", children: "Talk to a real person" }), _jsx("h1", { children: "Tell us what\u2019s on your mind." }), _jsx("p", { children: "Questions, feedback, or a hand getting started\u2014we\u2019d love to hear from you. Send a note and we\u2019ll point you in the right direction." }), _jsxs("div", { className: "company-contact-promise", children: [_jsxs("span", { children: [_jsx(Clock3, { size: 16, "aria-hidden": "true" }), " We aim to reply within two business days."] }), _jsxs("span", { children: [_jsx(ShieldAlert, { size: 16, "aria-hidden": "true" }), " Never include passwords or secret values."] })] })] }), _jsxs("div", { className: "company-contact-card", children: [_jsxs("div", { className: "company-contact-card__heading", children: [_jsx("span", { className: "company-card__icon", children: _jsx(MessageSquareText, { size: 20, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("p", { className: "legal-eyebrow", children: "Send an enquiry" }), _jsx("h2", { children: "How can we help?" })] })] }), submitted ? (_jsxs("div", { className: "company-form-success", role: "status", children: [_jsx(CheckCircle2, { size: 26, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("h3", { children: "Your message is on its way." }), _jsx("p", { children: "Thanks for reaching out. We\u2019ll get back to you as soon as we can." })] })] })) : (_jsxs("form", { className: "company-contact-form", onSubmit: handleSubmit, children: [_jsxs("div", { className: "company-form-row", children: [_jsxs("label", { children: ["Your name", _jsx("input", { name: "name", type: "text", autoComplete: "name", minLength: 1, maxLength: 100, required: true })] }), _jsxs("label", { children: ["Email address", _jsx("input", { name: "email", type: "email", autoComplete: "email", maxLength: 254, required: true })] })] }), _jsxs("label", { children: ["What can we help with?", _jsxs("select", { name: "topic", defaultValue: "", required: true, children: [_jsx("option", { value: "", disabled: true, children: "Select a topic" }), _jsx("option", { children: "General question" }), _jsx("option", { children: "Account help" }), _jsx("option", { children: "Product feedback" }), _jsx("option", { children: "Partnership" })] })] }), _jsxs("label", { children: ["Your message", _jsx("textarea", { name: "message", rows: 5, minLength: 10, maxLength: 5000, "aria-describedby": "contact-message-hint", placeholder: "Share a little context so we can help.", required: true }), _jsx("span", { className: "company-field-hint", id: "contact-message-hint", children: "Please don\u2019t include passwords, recovery phrases, or credential values." })] }), error && _jsx("p", { className: "company-form-error", role: "alert", children: error }), _jsxs("button", { className: "public-button company-form-submit", type: "submit", disabled: isSubmitting, children: [isSubmitting ? 'Sending…' : 'Send message', !isSubmitting && _jsx(ArrowRight, { size: 16, "aria-hidden": "true" })] })] }))] })] }) }), _jsxs("section", { className: "company-contact-alternatives public-container", children: [_jsxs("div", { children: [_jsx("span", { className: "company-contact-alternatives__icon", children: _jsx(Mail, { size: 18, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h2", { children: "Prefer email?" }), _jsxs("p", { children: ["Reach us directly at ", _jsx("a", { href: `mailto:${CONTACT_EMAIL}`, children: CONTACT_EMAIL }), "."] })] })] }), _jsxs("p", { children: ["Need an answer to a common question? Browse ", _jsxs(Link, { to: "/support", children: ["Support and FAQs ", _jsx(ArrowRight, { size: 14, "aria-hidden": "true" })] }), "."] })] })] }) }));
}
