import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Shield, Users, Eye, Share2, KeyRound, ArrowRight } from 'lucide-react';
import './landing.css';
export default function LandingPage() {
    useEffect(() => {
        const els = document.querySelectorAll('.reveal');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('is-visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.12 });
        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []);
    return (_jsxs("div", { className: "lp", children: [_jsx(LPNav, {}), _jsx(LPHero, {}), _jsx(LPLogos, {}), _jsx(LPFeatures, {}), _jsx(LPSteps, {}), _jsx(LPQuote, {}), _jsx(LPCta, {}), _jsx(LPFooter, {})] }));
}
function LPNav() {
    const [solid, setSolid] = useState(false);
    useEffect(() => {
        const fn = () => setSolid(window.scrollY > 32);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);
    return (_jsx("header", { className: `lp-nav ${solid ? 'lp-nav--solid' : ''}`, children: _jsxs("div", { className: "lp-nav__row", children: [_jsxs(Link, { to: "/", className: "lp-nav__brand", children: [_jsx(Lock, { size: 18, strokeWidth: 2, "aria-hidden": "true" }), "Vaultnary"] }), _jsxs("nav", { "aria-label": "Site navigation", className: "lp-nav__links", children: [_jsx("a", { href: "#features", className: "lp-nav__link", children: "Features" }), _jsx("a", { href: "#steps", className: "lp-nav__link", children: "How it works" }), _jsx(Link, { to: "/login", className: "lp-nav__link", children: "Sign in" }), _jsx(Link, { to: "/register", className: "lp-btn-outline", children: "Get started" })] })] }) }));
}
function LPHero() {
    const bgRef = useRef(null);
    useEffect(() => {
        const fn = () => {
            if (bgRef.current)
                bgRef.current.style.transform = `translateY(${window.scrollY * 0.28}px)`;
        };
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);
    return (_jsxs("section", { className: "lp-hero", "aria-label": "Introduction", children: [_jsx("div", { className: "lp-hero__bg", ref: bgRef }), _jsx("div", { className: "lp-hero__scrim", "aria-hidden": "true" }), _jsxs("div", { className: "lp-wrap lp-hero__body", children: [_jsx("p", { className: "lp-hero__eyebrow reveal", children: "Credential management, done right" }), _jsxs("h1", { className: "lp-hero__h1 reveal", children: ["Every password.", _jsx("br", {}), "Every key.", _jsx("br", {}), "Always secure."] }), _jsx("p", { className: "lp-hero__sub reveal", children: "The one place your team stores, organises, and safely shares credentials -without ever putting anyone at risk." }), _jsxs("div", { className: "lp-hero__actions reveal", children: [_jsxs(Link, { to: "/register", className: "lp-btn-primary", children: ["Start for free ", _jsx(ArrowRight, { size: 15, strokeWidth: 2.5, "aria-hidden": "true" })] }), _jsx(Link, { to: "/login", className: "lp-btn-ghost", children: "Sign in to vault" })] })] })] }));
}
const logoNames = ['Acme Corp', 'Horizon Labs', 'Stackflow', 'Relay Inc', 'Northgate'];
function LPLogos() {
    return (_jsx("div", { className: "lp-logos", "aria-label": "Trusted by teams like", children: _jsxs("div", { className: "lp-wrap lp-logos__row", children: [_jsx("span", { className: "lp-logos__label", children: "Trusted by engineering teams at" }), logoNames.map((n) => (_jsx("span", { className: "lp-logos__name", children: n }, n)))] }) }));
}
const features = [
    {
        icon: Lock,
        title: 'Yours and only yours',
        body: 'Everything you save is locked before it leaves your device. Nobody else -including us -can read your secrets.',
        img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=720&q=80&auto=format&fit=crop',
        alt: 'A single key on a clean surface',
    },
    {
        icon: Users,
        title: 'Share access, not passwords',
        body: 'Give a teammate access to exactly one credential. Control who sees what, and take it back in a single click.',
        img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=720&q=80&auto=format&fit=crop',
        alt: 'Two colleagues reviewing work together',
    },
    {
        icon: KeyRound,
        title: 'Every type of credential',
        body: 'Passwords, API tokens, SSH keys, two-factor codes, database logins -all in one organised, searchable vault.',
        img: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=720&q=80&auto=format&fit=crop',
        alt: 'Organised key rack',
    },
    {
        icon: Eye,
        title: 'A record of everything',
        body: 'See exactly who accessed what and when. A permanent log your team can rely on for accountability and audit.',
        img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=720&q=80&auto=format&fit=crop',
        alt: 'Clean data dashboard',
    },
    {
        icon: Share2,
        title: 'Organised around your projects',
        body: 'Tag credentials to the projects and environments they belong to. Find the right key the moment you need it.',
        img: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=720&q=80&auto=format&fit=crop',
        alt: 'Neatly organised folders on a desk',
    },
    {
        icon: Shield,
        title: 'Never locked out again',
        body: 'Set a recovery phrase once. If you ever lose access, your vault is still yours to get back -no support ticket needed.',
        img: 'https://images.unsplash.com/photo-1433888104895-5b54e9988929?w=720&q=80&auto=format&fit=crop',
        alt: 'Spare key on a hook',
    },
];
function LPFeatures() {
    return (_jsx("section", { id: "features", className: "lp-features", "aria-label": "Features", children: _jsxs("div", { className: "lp-wrap", children: [_jsxs("div", { className: "lp-section-hd reveal", children: [_jsx("p", { className: "lp-eyebrow", children: "What you get" }), _jsx("h2", { className: "lp-h2", children: "Built for teams who can't afford a breach" }), _jsx("p", { className: "lp-lead", children: "Stop emailing passwords. Stop using shared accounts. Start doing it properly." })] }), _jsx("div", { className: "lp-features__list", children: features.map((f, i) => _jsx(FeatureRow, { f: f, flip: i % 2 !== 0 }, f.title)) })] }) }));
}
function FeatureRow({ f, flip }) {
    const ref = useRef(null);
    const [vis, setVis] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) {
            setVis(true);
            obs.disconnect();
        } }, { threshold: 0.15 });
        if (ref.current)
            obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);
    return (_jsxs("div", { ref: ref, className: `lp-frow ${flip ? 'lp-frow--flip' : ''} ${vis ? 'lp-frow--vis' : ''}`, children: [_jsx("div", { className: "lp-frow__img-wrap", children: _jsx("img", { src: f.img, alt: f.alt, className: "lp-frow__img", loading: "lazy" }) }), _jsxs("div", { className: "lp-frow__copy", children: [_jsx(f.icon, { size: 28, strokeWidth: 1.5, className: "lp-frow__icon", "aria-hidden": "true" }), _jsx("h3", { className: "lp-frow__title", children: f.title }), _jsx("p", { className: "lp-frow__body", children: f.body })] })] }));
}
const steps = [
    { n: '01', title: 'Create your vault', body: 'Sign up with your email address. Your private vault is ready in under a minute.' },
    { n: '02', title: 'Add your credentials', body: 'Type in a password, paste an API key, or store an SSH key -any kind of secret.' },
    { n: '03', title: 'Unlock only when you need to', body: 'Your vault stays closed until you open it. Like a physical safe, but in your browser.' },
    { n: '04', title: 'Share just what you choose', body: 'Give one teammate access to one secret. Take it back any time. Nothing more leaks.' },
];
function LPSteps() {
    return (_jsxs("section", { id: "steps", className: "lp-steps", "aria-label": "How it works", children: [_jsx("div", { className: "lp-steps__bg", "aria-hidden": "true" }), _jsxs("div", { className: "lp-wrap lp-steps__inner", children: [_jsxs("div", { className: "lp-section-hd reveal", children: [_jsx("p", { className: "lp-eyebrow", children: "Simple by design" }), _jsx("h2", { className: "lp-h2", children: "Ready in four steps" })] }), _jsx("ol", { className: "lp-steps__list", "aria-label": "Steps to get started", children: steps.map((s, i) => _jsx(StepCard, { s: s, delay: i * 100 }, s.n)) })] })] }));
}
function StepCard({ s, delay }) {
    const ref = useRef(null);
    const [vis, setVis] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) {
            setVis(true);
            obs.disconnect();
        } }, { threshold: 0.2 });
        if (ref.current)
            obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);
    return (_jsxs("li", { ref: ref, className: `lp-step ${vis ? 'lp-step--vis' : ''}`, style: { transitionDelay: `${delay}ms` }, children: [_jsx("span", { className: "lp-step__n", "aria-hidden": "true", children: s.n }), _jsx("strong", { className: "lp-step__title", children: s.title }), _jsx("p", { className: "lp-step__body", children: s.body })] }));
}
function LPQuote() {
    return (_jsx("section", { className: "lp-quote", "aria-label": "Customer quote", children: _jsxs("div", { className: "lp-wrap lp-quote__inner reveal", children: [_jsx("blockquote", { className: "lp-quote__text", children: "\"We spent years sharing credentials over Slack and hoping nothing leaked. Vaultnary fixed that in an afternoon.\"" }), _jsx("cite", { className: "lp-quote__attr", children: "Head of Engineering, a 40-person product team" })] }) }));
}
function LPCta() {
    return (_jsxs("section", { className: "lp-cta", "aria-label": "Get started", children: [_jsx("div", { className: "lp-cta__bg", "aria-hidden": "true" }), _jsx("div", { className: "lp-cta__scrim", "aria-hidden": "true" }), _jsxs("div", { className: "lp-wrap lp-cta__inner reveal", children: [_jsxs("h2", { className: "lp-cta__h2", children: ["Stop sharing passwords.", _jsx("br", {}), "Start sharing access."] }), _jsx("p", { className: "lp-cta__sub", children: "Free to start. No credit card. Works immediately." }), _jsxs(Link, { to: "/register", className: "lp-btn-primary lp-btn-primary--lg", children: ["Create your free vault ", _jsx(ArrowRight, { size: 16, strokeWidth: 2.5, "aria-hidden": "true" })] })] })] }));
}
function LPFooter() {
    return (_jsx("footer", { className: "lp-footer", role: "contentinfo", children: _jsxs("div", { className: "lp-wrap", children: [_jsxs("div", { className: "lp-footer__row", children: [_jsxs("span", { className: "lp-footer__brand", children: [_jsx(Lock, { size: 15, strokeWidth: 2, "aria-hidden": "true" }), " Vaultnary"] }), _jsx("p", { className: "lp-footer__copy", children: "Your credentials, always under your control." }), _jsxs("nav", { "aria-label": "Footer links", className: "lp-footer__links", children: [_jsx(Link, { to: "/register", children: "Get started" }), _jsx(Link, { to: "/login", children: "Sign in" })] })] }), _jsxs("div", { className: "lp-footer__bottom", children: [_jsxs("p", { className: "lp-footer__legal", children: ["\u00A9 ", new Date().getFullYear(), " Naren S J. All rights reserved. Proprietary software \u2014 not open source."] }), _jsx("p", { className: "lp-footer__legal", children: "narensonu1520@gmail.com" })] })] }) }));
}
