import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, ChevronRight, Clock3, Eye, FolderKanban, KeyRound, LockKeyhole, ShieldCheck, Users, } from 'lucide-react';
import logoUrl from '../../assets/logo.png';
import LaptopCard from './components/LaptopCard';
import SecurityMascot from './components/SecurityMascot';
import VantaTopology from './components/VantaTopology';
import WorkspacePreview from './components/WorkspacePreview';
import SiteMetadata from '../seo/SiteMetadata';
import './landing.css';
const features = [
    {
        icon: LockKeyhole,
        title: 'Private by design',
        body: 'Keep sensitive values encrypted in your vault, with control over when they are unlocked.',
        detail: 'A calmer place for sensitive work',
    },
    {
        icon: Users,
        title: 'Share with intention',
        body: 'Invite teammates to the workspace and manage who can access shared credentials.',
        detail: 'Access that follows your team',
    },
    {
        icon: FolderKanban,
        title: 'Everything in context',
        body: 'Organize credentials around workspaces, projects, and the services they support.',
        detail: 'Less hunting, more doing',
    },
    {
        icon: Eye,
        title: 'Know what happened',
        body: 'Review security activity and audit events when your team needs a clear history.',
        detail: 'Visibility when it matters',
    },
];
const steps = [
    {
        number: '01',
        title: 'Create a workspace',
        body: 'Bring the right people and projects together in one shared space.',
    },
    {
        number: '02',
        title: 'Add your credentials',
        body: 'Keep the keys and account details your team relies on organized.',
    },
    {
        number: '03',
        title: 'Share only what is needed',
        body: 'Manage membership and credential access as your team changes.',
    },
];
const workspaceLevels = [
    {
        icon: Users,
        number: '01',
        title: 'Workspace',
        body: 'Bring the people and shared information for a team into one clear home.',
    },
    {
        icon: FolderKanban,
        number: '02',
        title: 'Project',
        body: 'Group related work together so credentials stay connected to their purpose.',
    },
    {
        icon: KeyRound,
        number: '03',
        title: 'Credential',
        body: 'Keep the account details your team uses organized and easier to find.',
    },
];
export default function LandingPage() {
    const [navSolid, setNavSolid] = useState(false);
    useEffect(() => {
        document.documentElement.classList.add('lp-hide-scrollbar');
        document.body.classList.add('lp-hide-scrollbar');
        const revealElements = document.querySelectorAll('.lp-reveal');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('lp-reveal--visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        revealElements.forEach((element) => observer.observe(element));
        let scrollFrame = 0;
        const updateNavigation = () => {
            if (scrollFrame)
                return;
            scrollFrame = window.requestAnimationFrame(() => {
                scrollFrame = 0;
                const scrollY = window.scrollY;
                setNavSolid(scrollY > 16);
            });
        };
        updateNavigation();
        window.addEventListener('scroll', updateNavigation, { passive: true });
        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', updateNavigation);
            if (scrollFrame)
                window.cancelAnimationFrame(scrollFrame);
            document.documentElement.classList.remove('lp-hide-scrollbar');
            document.body.classList.remove('lp-hide-scrollbar');
        };
    }, []);
    return (_jsxs("div", { className: "lp", children: [_jsx(SiteMetadata, { title: "Secure Team Password and Credential Manager", description: "Vaultnary helps teams organize shared passwords and credentials, manage workspace access, and protect sensitive vault fields with browser-side encryption." }), _jsx("header", { className: `lp-nav ${navSolid ? 'lp-nav--solid' : ''}`, children: _jsxs("div", { className: "lp-container lp-nav__inner", children: [_jsxs(Link, { to: "/", className: "lp-brand", "aria-label": "Vaultnary home", children: [_jsx("img", { src: logoUrl, alt: "Vaultnary" }), _jsx("span", { "aria-hidden": "true", children: "Vaultnary" })] }), _jsxs("div", { className: "lp-nav__actions", children: [_jsx(Link, { to: "/login", className: "lp-nav__login", children: "Log in" }), _jsxs(Link, { to: "/register", className: "lp-button lp-button--small", children: ["Get started ", _jsx(ArrowRight, { size: 15 })] })] })] }) }), _jsxs("main", { children: [_jsxs("div", { className: "lp-opening", children: [_jsx(VantaTopology, {}), _jsxs("section", { className: "lp-hero", children: [_jsxs("div", { className: "lp-container lp-hero__inner", children: [_jsxs("div", { className: "lp-hero__copy", children: [_jsxs("p", { className: "lp-kicker", children: [_jsx("span", {}), " A better home for team credentials"] }), _jsxs("h1", { children: ["Keep your team\u2019s keys ", _jsx("span", { children: "in good hands." })] }), _jsx("p", { className: "lp-hero__description", children: "Vaultnary brings credentials, people, and projects together-so your team can share access with clarity and confidence." }), _jsxs("div", { className: "lp-hero__actions", children: [_jsxs(Link, { to: "/register", className: "lp-button", children: ["Create your workspace ", _jsx(ArrowRight, { size: 17 })] }), _jsxs("a", { href: "#product", className: "lp-text-link", children: ["Explore the product ", _jsx(ChevronRight, { size: 16 })] })] }), _jsxs("div", { className: "lp-hero__note", children: [_jsx(ShieldCheck, { size: 17 }), _jsx("span", { children: "Organized access. Clear ownership. One secure workspace." })] })] }), _jsx(WorkspacePreview, {})] }), _jsxs("a", { className: "lp-scroll-cue", href: "#product", children: [_jsx(ArrowDown, { size: 14 }), " Scroll to explore"] })] }), _jsx("section", { className: "lp-principles", "aria-label": "Product principles", children: _jsxs("div", { className: "lp-container lp-principles__inner", children: [_jsx("span", { children: "Built around the way teams work" }), _jsxs("div", { children: [_jsx(LockKeyhole, { size: 16 }), " Private vault"] }), _jsxs("div", { children: [_jsx(Users, { size: 16 }), " Team workspaces"] }), _jsxs("div", { children: [_jsx(Clock3, { size: 16 }), " Activity history"] })] }) }), _jsx("section", { id: "product", className: "lp-section lp-product lp-opening-product", children: _jsxs("div", { className: "lp-container lp-opening-product__layout", children: [_jsx("div", { className: "lp-opening-product__device", children: _jsxs("div", { className: "lp-opening-product__sticky", children: [_jsx("p", { className: "lp-device-showcase__eyebrow", children: "A better view of your workspace" }), _jsx(LaptopCard, {})] }) }), _jsxs("div", { className: "lp-opening-product__content", children: [_jsxs("div", { className: "lp-section-heading lp-opening-product__heading lp-reveal", children: [_jsx("p", { className: "lp-eyebrow", children: "One connected workspace" }), _jsxs("h2", { children: ["Less scattered access.", _jsx("br", {}), _jsx("span", { children: "More intentional teamwork." })] }), _jsx("p", { children: "Give every credential a place, every teammate a role, and every project the context it needs." })] }), _jsx("div", { className: "lp-feature-grid", children: features.map(({ icon: Icon, title, body, detail }, index) => (_jsxs("article", { className: "lp-feature-card lp-reveal lp-reveal--zoom", children: [_jsxs("div", { className: "lp-feature-card__top", children: [_jsx("span", { className: "lp-feature-card__icon", children: _jsx(Icon, { size: 20, strokeWidth: 1.8 }) }), _jsxs("span", { className: "lp-feature-card__number", children: ["0", index + 1] })] }), _jsxs("div", { className: "lp-feature-card__copy", children: [_jsx("h3", { children: title }), _jsx("p", { children: body })] }), _jsxs("div", { className: `lp-feature-card__visual lp-feature-card__visual--${index + 1}`, "aria-hidden": "true", children: [index === 0 && (_jsxs("div", { className: "lp-visual-vault", children: [_jsxs("div", { className: "lp-visual-vault__row", children: [_jsx("span", { className: "lp-visual-vault__mark", children: _jsx(KeyRound, { size: 13 }) }), _jsxs("span", { className: "lp-visual-vault__name", children: [_jsx("b", { children: "Production API" }), _jsx("small", { children: "Credential" })] }), _jsxs("span", { className: "lp-visual-vault__state", children: [_jsx(LockKeyhole, { size: 11 }), " SEALED"] })] }), _jsxs("div", { className: "lp-visual-vault__row", children: [_jsx("span", { className: "lp-visual-vault__mark", children: _jsx(KeyRound, { size: 13 }) }), _jsxs("span", { className: "lp-visual-vault__name", children: [_jsx("b", { children: "Database token" }), _jsx("small", { children: "Credential" })] }), _jsxs("span", { className: "lp-visual-vault__state", children: [_jsx(LockKeyhole, { size: 11 }), " SEALED"] })] })] })), index === 1 && (_jsxs("div", { className: "lp-visual-team", children: [_jsxs("div", { className: "lp-visual-team__member", children: [_jsx("span", { className: "lp-visual-team__avatar", children: "NS" }), _jsxs("span", { children: [_jsx("b", { children: "Naren S J" }), _jsx("small", { children: "Workspace owner" })] }), _jsx("i", { className: "lp-visual-team__role", children: "OWNER" })] }), _jsxs("div", { className: "lp-visual-team__member", children: [_jsx("span", { className: "lp-visual-team__avatar lp-visual-team__avatar--alt", children: "AM" }), _jsxs("span", { children: [_jsx("b", { children: "Alex Morgan" }), _jsx("small", { children: "Project member" })] }), _jsx("i", { className: "lp-visual-team__role", children: "MEMBER" })] })] })), index === 2 && (_jsxs("div", { className: "lp-visual-tree", children: [_jsxs("div", { className: "lp-visual-tree__row lp-visual-tree__row--root", children: [_jsx("span", { children: _jsx(Users, { size: 12 }) }), _jsx("b", { children: "Engineering" }), _jsx("small", { children: "Workspace" })] }), _jsxs("div", { className: "lp-visual-tree__branch", children: [_jsxs("div", { className: "lp-visual-tree__row", children: [_jsx("span", { children: _jsx(FolderKanban, { size: 12 }) }), _jsx("b", { children: "Platform" }), _jsx("small", { children: "Project" })] }), _jsxs("div", { className: "lp-visual-tree__row", children: [_jsx("span", { children: _jsx(KeyRound, { size: 12 }) }), _jsx("b", { children: "Production API" }), _jsx("small", { children: "Credential" })] })] })] })), index === 3 && (_jsxs("div", { className: "lp-visual-activity", children: [_jsxs("div", { className: "lp-visual-activity__row", children: [_jsx("span", { className: "lp-visual-activity__dot" }), _jsxs("span", { children: [_jsx("b", { children: "Credential accessed" }), _jsx("small", { children: "Production API" })] }), _jsx("time", { children: "2m ago" })] }), _jsxs("div", { className: "lp-visual-activity__row", children: [_jsx("span", { className: "lp-visual-activity__dot lp-visual-activity__dot--muted" }), _jsxs("span", { children: [_jsx("b", { children: "Member invited" }), _jsx("small", { children: "Engineering workspace" })] }), _jsx("time", { children: "1h ago" })] })] }))] }), _jsxs("span", { className: "lp-feature-card__detail", children: [_jsx(Check, { size: 14 }), " ", detail] })] }, title))) })] })] }) }), _jsx("section", { className: "lp-opening-video", "aria-label": "Vaultnary product video", children: _jsx("div", { className: "lp-container", children: _jsx("div", { className: "lp-opening-video__frame", children: _jsxs("video", { autoPlay: true, loop: true, muted: true, playsInline: true, preload: "metadata", poster: `${import.meta.env.BASE_URL}images/img1.jpg`, "aria-label": "Vaultnary product demonstration", children: [_jsx("source", { src: `${import.meta.env.BASE_URL}videos/video.mp4`, type: "video/mp4" }), "Your browser does not support embedded videos."] }) }) }) })] }), _jsx("section", { id: "workspaces", className: "lp-section lp-structure", children: _jsxs("div", { className: "lp-container", children: [_jsxs("div", { className: "lp-section-heading lp-structure__heading lp-reveal", children: [_jsx("p", { className: "lp-eyebrow", children: "A place for every part of the work" }), _jsxs("h2", { children: ["Everything has a home.", _jsx("br", {}), _jsx("span", { children: "Nothing feels out of context." })] }), _jsx("p", { children: "Move from the bigger picture to the details your team needs, with a simple structure that keeps related work together." })] }), _jsx("div", { className: "lp-structure__grid", children: workspaceLevels.map(({ icon: Icon, number, title, body }) => (_jsxs("article", { className: "lp-structure-card lp-reveal lp-reveal--from-side", children: [_jsxs("div", { className: "lp-structure-card__top", children: [_jsx("span", { className: "lp-structure-card__icon", children: _jsx(Icon, { size: 20, strokeWidth: 1.8 }) }), _jsx("span", { children: number })] }), _jsx("p", { className: "lp-structure-card__label", children: "YOUR VAULTNARY STRUCTURE" }), _jsx("h3", { children: title }), _jsx("p", { className: "lp-structure-card__body", children: body })] }, title))) })] }) }), _jsx("section", { id: "how-it-works", className: "lp-section lp-workflow", children: _jsxs("div", { className: "lp-container lp-workflow__layout", children: [_jsxs("div", { className: "lp-workflow__intro lp-reveal", children: [_jsx("p", { className: "lp-eyebrow", children: "A clear path from day one" }), _jsx("h2", { children: "Good security should fit into the work you already do." }), _jsx("p", { children: "Start with a workspace, build a useful structure, and invite the people who need access. No shared spreadsheets or mystery accounts." }), _jsxs(Link, { to: "/register", className: "lp-text-link", children: ["Set up your workspace ", _jsx(ArrowRight, { size: 16 })] })] }), _jsx("ol", { className: "lp-steps", children: steps.map((step) => (_jsxs("li", { className: "lp-step lp-reveal", children: [_jsx("span", { className: "lp-step__number", children: step.number }), _jsxs("div", { children: [_jsx("h3", { children: step.title }), _jsx("p", { children: step.body })] }), _jsx(ChevronRight, { size: 18, className: "lp-step__arrow" })] }, step.number))) })] }) }), _jsx("section", { id: "security", className: "lp-security", children: _jsxs("div", { className: "lp-container lp-security__inner", children: [_jsxs("div", { className: "lp-security__visual lp-reveal lp-reveal--zoom", "aria-hidden": "true", children: [_jsx(SecurityMascot, {}), _jsxs("span", { className: "lp-security__badge", children: [_jsx(ShieldCheck, { size: 17 }), " Control stays with you"] })] }), _jsxs("div", { className: "lp-security__copy lp-reveal", children: [_jsx("p", { className: "lp-eyebrow", children: "Security with clarity" }), _jsx("h2", { children: "Your credentials are important. Their access should be deliberate." }), _jsx("p", { children: "Keep your team\u2019s sensitive information organized, share it with the right people, and review activity from one place." }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx(Check, { size: 16 }), " Workspace roles and member management"] }), _jsxs("li", { children: [_jsx(Check, { size: 16 }), " Credential sharing with access controls"] }), _jsxs("li", { children: [_jsx(Check, { size: 16 }), " Audit and security activity views"] })] }), _jsxs(Link, { to: "/register", className: "lp-text-link", children: ["Take a closer look ", _jsx(ArrowRight, { size: 16 })] })] })] }) }), _jsx("section", { className: "lp-final-cta", children: _jsxs("div", { className: "lp-container lp-final-cta__inner lp-reveal", children: [_jsxs("div", { children: [_jsx("p", { className: "lp-eyebrow", children: "Make access easier to manage" }), _jsx("h2", { children: "Give your team a better way to work with secrets." }), _jsx("p", { children: "Start organizing credentials and team access in Vaultnary." })] }), _jsxs(Link, { to: "/register", className: "lp-button lp-button--light", children: ["Get started ", _jsx(ArrowRight, { size: 17 })] })] }) })] }), _jsx("footer", { className: "lp-footer", children: _jsxs("div", { className: "lp-container", children: [_jsxs("div", { className: "lp-footer__top", children: [_jsxs("div", { className: "lp-footer__brand-block", children: [_jsx(Link, { to: "/", className: "lp-brand", "aria-label": "Vaultnary home", children: _jsx("img", { src: logoUrl, alt: "Vaultnary" }) }), _jsx("p", { children: "A thoughtful home for the credentials, projects, and people your team relies on." })] }), _jsxs("nav", { className: "lp-footer__column", "aria-label": "Explore Vaultnary", children: [_jsx("h2", { children: "Explore" }), _jsx("a", { href: "#product", children: "Product" }), _jsx("a", { href: "#workspaces", children: "Workspaces" }), _jsx("a", { href: "#how-it-works", children: "How it works" })] }), _jsxs("nav", { className: "lp-footer__column", "aria-label": "Your account", children: [_jsx("h2", { children: "Account" }), _jsx(Link, { to: "/login", children: "Log in" }), _jsx(Link, { to: "/register", children: "Create an account" }), _jsx(Link, { to: "/forgot-password", children: "Reset password" })] }), _jsxs("nav", { className: "lp-footer__column", "aria-label": "Help and company", children: [_jsx("h2", { children: "Help & company" }), _jsx(Link, { to: "/about", children: "About" }), _jsx(Link, { to: "/support", children: "Support" }), _jsx(Link, { to: "/contact", children: "Contact" })] }), _jsxs("nav", { className: "lp-footer__column", "aria-label": "Policies and security", children: [_jsx("h2", { children: "Policies" }), _jsx(Link, { to: "/security", children: "Security" }), _jsx(Link, { to: "/privacy", children: "Privacy" }), _jsx(Link, { to: "/terms", children: "Terms" })] })] }), _jsxs("div", { className: "lp-footer__bottom", children: [_jsxs("span", { children: ["\u00A9 ", new Date().getFullYear(), " Vaultnary"] }), _jsx("span", { children: "Keep team access clear and in context." }), _jsxs(Link, { to: "/register", children: ["Create your workspace ", _jsx(ArrowRight, { size: 14 })] })] })] }) })] }));
}
