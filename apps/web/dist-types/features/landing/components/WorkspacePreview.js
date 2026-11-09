import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Check, ChevronRight, Clock3, FolderKanban, GitBranch, KeyRound, LockKeyhole, ScrollText, Search, Server, ShieldCheck, Users, } from 'lucide-react';
import './workspace-preview.css';
const pages = [
    {
        id: 'vault',
        label: 'Vault',
        icon: KeyRound,
        eyebrow: 'YOUR WORKSPACE',
        title: 'Credential vault',
        description: 'Find the credentials your team relies on.',
        layout: 'table',
        stats: [
            { label: 'Credentials', value: '12' },
            { label: 'Projects', value: '04' },
            { label: 'Members', value: '06' },
        ],
        columns: ['TYPE', 'TAGS', 'LAST ACCESSED'],
        rows: [
            { name: 'Production API', detail: 'API credential', meta: 'Platform', status: 'Just now', initial: 'S' },
            { name: 'Database access', detail: 'Database credential', meta: 'Platform', status: '2 hours ago', initial: 'D', tone: 'green' },
            { name: 'Analytics account', detail: 'Account credential', meta: 'Growth', status: 'Yesterday', initial: 'G', tone: 'amber' },
        ],
    },
    {
        id: 'hierarchy',
        label: 'Hierarchy',
        icon: GitBranch,
        eyebrow: 'HOW WORK IS ORGANIZED',
        title: 'Workspace hierarchy',
        description: 'Move from shared workspaces to the credentials inside each project.',
        layout: 'hierarchy',
        stats: [
            { label: 'Workspaces', value: '03' },
            { label: 'Projects', value: '08' },
            { label: 'Services', value: '16' },
        ],
        columns: ['TYPE', 'OWNER', 'ITEMS'],
        rows: [],
    },
    {
        id: 'projects',
        label: 'Projects',
        icon: FolderKanban,
        eyebrow: 'TEAM PROJECTS',
        title: 'Projects',
        description: 'Keep credentials connected to the work they support.',
        layout: 'cards',
        stats: [
            { label: 'Active projects', value: '04' },
            { label: 'Services', value: '16' },
            { label: 'Owners', value: '05' },
        ],
        columns: ['OWNER', 'SERVICES', 'UPDATED'],
        rows: [
            { name: 'Platform', detail: 'Core product infrastructure', meta: 'Naren · 6 services', status: 'Updated today', initial: 'P' },
            { name: 'Growth', detail: 'Analytics and campaigns', meta: 'Maya · 3 services', status: 'Updated yesterday', initial: 'G', tone: 'green' },
            { name: 'Customer Portal', detail: 'Customer-facing application', meta: 'Arun · 4 services', status: 'Updated 2 days ago', initial: 'C', tone: 'amber' },
        ],
    },
    {
        id: 'services',
        label: 'Services',
        icon: Server,
        eyebrow: 'CONNECTED TO YOUR PROJECTS',
        title: 'Services',
        description: 'See which services are configured and who maintains them.',
        layout: 'table',
        stats: [
            { label: 'Services', value: '16' },
            { label: 'Connected', value: '14' },
            { label: 'Need review', value: '02' },
        ],
        columns: ['PROJECT', 'CREDENTIALS', 'HEALTH'],
        rows: [
            { name: 'Production API', detail: 'API service', meta: 'Platform', status: 'Healthy', initial: 'A', tone: 'green' },
            { name: 'PostgreSQL', detail: 'Database', meta: 'Platform', status: 'Healthy', initial: 'P', tone: 'green' },
            { name: 'Analytics', detail: 'Data service', meta: 'Growth', status: 'Review access', initial: 'A', tone: 'amber' },
        ],
    },
    {
        id: 'workspaces',
        label: 'Workspaces',
        icon: Users,
        eyebrow: 'PEOPLE AND ACCESS',
        title: 'Workspaces',
        description: 'Bring the right people and projects together in one place.',
        layout: 'cards',
        stats: [
            { label: 'Workspaces', value: '03' },
            { label: 'Members', value: '18' },
            { label: 'Invites', value: '02' },
        ],
        columns: ['OWNER', 'MEMBERS', 'PROJECTS'],
        rows: [
            { name: 'Acme Studio', detail: 'Engineering and product', meta: 'Naren · 8 members', status: '4 projects', initial: 'A' },
            { name: 'Growth Team', detail: 'Marketing and analytics', meta: 'Maya · 6 members', status: '3 projects', initial: 'G', tone: 'green' },
            { name: 'Client Operations', detail: 'Customer success', meta: 'Arun · 4 members', status: '2 projects', initial: 'C', tone: 'amber' },
        ],
    },
    {
        id: 'security',
        label: 'Security',
        icon: ShieldCheck,
        eyebrow: 'WORKSPACE PROTECTION',
        title: 'Security overview',
        description: 'A quick view of access hygiene and recent security checks.',
        layout: 'security',
        stats: [
            { label: 'Protected', value: '100%' },
            { label: 'Members', value: '06' },
            { label: 'Open reviews', value: '01' },
        ],
        columns: ['CHECK', 'SCOPE', 'STATUS'],
        rows: [
            { name: 'Workspace access', detail: 'Member roles are assigned', meta: '6 members', status: 'Protected', initial: 'A', tone: 'green' },
            { name: 'Credential sharing', detail: 'Access is limited to project members', meta: '12 credentials', status: 'Protected', initial: 'C', tone: 'green' },
            { name: 'Access review', detail: 'One credential is due for review', meta: 'Analytics account', status: 'Review due', initial: 'R', tone: 'amber' },
        ],
    },
    {
        id: 'audit',
        label: 'Audit Log',
        icon: ScrollText,
        eyebrow: 'WORKSPACE ACTIVITY',
        title: 'Audit log',
        description: 'Review the latest changes across your shared workspace.',
        layout: 'timeline',
        stats: [
            { label: 'Events today', value: '08' },
            { label: 'Actors', value: '04' },
            { label: 'Attention', value: '00' },
        ],
        columns: ['ACTOR', 'EVENT', 'TIME'],
        rows: [
            { name: 'Naren', detail: 'Viewed Production API', meta: 'Platform', status: '2 min ago', initial: 'N' },
            { name: 'Maya', detail: 'Updated Growth workspace', meta: 'Workspace settings', status: '1 hour ago', initial: 'M', tone: 'green' },
            { name: 'Arun', detail: 'Added a project member', meta: 'Customer Portal', status: '3 hours ago', initial: 'A', tone: 'amber' },
        ],
    },
];
const workspaceTree = [
    {
        name: 'Acme Studio',
        kind: 'Workspace',
        detail: '8 members',
        icon: Users,
        children: [
            {
                name: 'Platform',
                kind: 'Project',
                detail: 'Engineering',
                icon: FolderKanban,
                children: [
                    {
                        name: 'Production API',
                        kind: 'Service',
                        detail: 'API service',
                        icon: Server,
                        children: [
                            { name: 'Production key', kind: 'Credential', detail: 'Updated just now', icon: KeyRound, tone: 'green' },
                            { name: 'Staging key', kind: 'Credential', detail: 'Updated yesterday', icon: KeyRound },
                        ],
                    },
                    {
                        name: 'PostgreSQL',
                        kind: 'Service',
                        detail: 'Database',
                        icon: Server,
                        children: [
                            { name: 'Database access', kind: 'Credential', detail: 'Updated 2 hours ago', icon: KeyRound, tone: 'amber' },
                        ],
                    },
                ],
            },
            {
                name: 'Growth',
                kind: 'Project',
                detail: 'Marketing',
                icon: FolderKanban,
                tone: 'amber',
                children: [
                    {
                        name: 'Analytics',
                        kind: 'Service',
                        detail: 'Data service',
                        icon: Server,
                        children: [
                            { name: 'Analytics account', kind: 'Credential', detail: 'Updated yesterday', icon: KeyRound },
                        ],
                    },
                ],
            },
        ],
    },
];
function HierarchyBranch({ nodes, path = '' }) {
    return (_jsx("ul", { className: "lp-preview__tree", children: nodes.map(({ name, kind, detail, icon: Icon, tone, children }) => {
            const nodePath = `${path}/${name}`;
            return (_jsxs("li", { className: "lp-preview__tree-node", children: [_jsxs("div", { className: "lp-preview__tree-card", children: [_jsx("span", { className: `lp-preview__tree-icon ${tone ? `lp-preview__tree-icon--${tone}` : ''}`, children: _jsx(Icon, { size: 13, "aria-hidden": "true" }) }), _jsxs("span", { className: "lp-preview__tree-copy", children: [_jsx("b", { children: name }), _jsxs("small", { children: [kind, " \u00B7 ", detail] })] }), children && _jsx("span", { className: "lp-preview__tree-count", children: children.length })] }), children && _jsx(HierarchyBranch, { nodes: children, path: nodePath })] }, nodePath));
        }) }));
}
function filterHierarchy(nodes, query) {
    const search = query.trim().toLowerCase();
    if (!search)
        return nodes;
    return nodes.flatMap((node) => {
        const children = filterHierarchy(node.children ?? [], search);
        const matches = `${node.name} ${node.kind} ${node.detail}`.toLowerCase().includes(search);
        return matches || children.length > 0 ? [{ ...node, children }] : [];
    });
}
export default function WorkspacePreview() {
    const [activePageId, setActivePageId] = useState('vault');
    const [query, setQuery] = useState('');
    const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
    const visibleRows = activePage.rows.filter((row) => `${row.name} ${row.detail} ${row.meta} ${row.status}`.toLowerCase().includes(query.toLowerCase()));
    const visibleTree = filterHierarchy(workspaceTree, query);
    const hasVisibleContent = activePage.layout === 'hierarchy'
        ? visibleTree.length > 0
        : visibleRows.length > 0;
    const handleSearch = (event) => {
        setQuery(event.target.value);
    };
    return (_jsx("div", { className: "lp-preview-wrap lp-reveal", children: _jsxs("section", { className: "lp-preview", "aria-label": "Interactive Vaultnary dashboard preview", children: [_jsxs("div", { className: "lp-preview__topbar", children: [_jsxs("div", { className: "lp-preview__dots", "aria-hidden": "true", children: [_jsx("i", {}), _jsx("i", {}), _jsx("i", {})] }), _jsxs("span", { children: ["Vaultnary ", _jsx("span", { children: "/" }), " ", activePage.label] }), _jsx("span", { className: "lp-preview__avatar", "aria-label": "Signed in as Naren", children: "N" })] }), _jsxs("div", { className: "lp-preview__body", children: [_jsxs("aside", { className: "lp-preview__sidebar", "aria-label": "Dashboard sections", children: [_jsx("div", { className: "lp-preview__workspace-mark", children: _jsx(LockKeyhole, { size: 14 }) }), _jsxs("span", { className: "lp-preview__workspace-name", children: ["Acme Studio ", _jsx(ChevronRight, { size: 12 })] }), _jsx("span", { className: "lp-preview__nav-label", children: "WORKSPACE" }), _jsx("nav", { className: "lp-preview__nav", "aria-label": "Workspace dashboard", children: pages.map(({ id, label, icon: Icon }) => (_jsxs("button", { "aria-current": activePageId === id ? 'page' : undefined, className: `lp-preview__nav-item ${activePageId === id ? 'lp-preview__nav-item--active' : ''}`, onClick: () => {
                                            setActivePageId(id);
                                            setQuery('');
                                        }, type: "button", children: [_jsx(Icon, { size: 14, "aria-hidden": "true" }), _jsx("span", { children: label })] }, id))) })] }), _jsxs("div", { className: "lp-preview__content", "aria-live": "polite", children: [_jsxs("div", { className: "lp-preview__heading", children: [_jsxs("div", { children: [_jsx("span", { className: "lp-preview__overline", children: activePage.eyebrow }), _jsx("h3", { children: activePage.title })] }), _jsxs("span", { className: "lp-preview__add", children: ["+ New ", activePage.id === 'vault' ? 'credential' : activePage.id === 'projects' ? 'project' : 'item'] })] }), _jsx("p", { className: "lp-preview__description", children: activePage.description }), _jsxs("label", { className: "lp-preview__search", children: [_jsx(Search, { size: 13, "aria-hidden": "true" }), _jsx("input", { "aria-label": `Search ${activePage.label.toLowerCase()}`, onChange: handleSearch, placeholder: `Search ${activePage.label.toLowerCase()}...`, type: "search", value: query }), _jsx("kbd", { "aria-hidden": "true", children: "\u2318 K" })] }), _jsx("div", { className: "lp-preview__summary", children: activePage.stats.map((stat) => (_jsxs("div", { children: [_jsx("span", { children: stat.label }), _jsx("strong", { children: stat.value })] }, stat.label))) }), _jsxs("div", { className: `lp-preview__records lp-preview__records--${activePage.layout}`, children: [activePage.layout === 'table' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "lp-preview__list-header", children: [_jsx("span", { children: "NAME" }), activePage.columns.map((column) => _jsx("span", { children: column }, column))] }), visibleRows.map((row) => (_jsxs("div", { className: "lp-preview__row", children: [_jsxs("span", { className: "lp-preview__credential", children: [_jsx("i", { className: `lp-preview__service-icon ${row.tone ? `lp-preview__service-icon--${row.tone}` : 'lp-preview__service-icon--neutral'}`, children: row.initial }), _jsx("span", { children: _jsx("b", { children: row.name }) })] }), _jsx("span", { className: "lp-preview__project", children: row.detail }), _jsx("span", { className: "lp-preview__project", children: row.meta }), _jsx("span", { className: `lp-preview__updated ${row.tone ? `lp-preview__updated--${row.tone}` : ''}`, children: row.status })] }, row.name)))] })), activePage.layout === 'cards' && visibleRows.map((row) => (_jsxs("article", { className: "lp-preview__record-card", children: [_jsx("span", { className: `lp-preview__service-icon ${row.tone ? `lp-preview__service-icon--${row.tone}` : 'lp-preview__service-icon--neutral'}`, children: row.initial }), _jsx("b", { children: row.name }), _jsx("small", { children: row.detail }), _jsx("span", { className: "lp-preview__record-meta", children: row.meta }), _jsx("span", { className: "lp-preview__record-status", children: row.status })] }, row.name))), activePage.layout === 'hierarchy' && (_jsx("div", { className: "lp-preview__tree-view", children: _jsx(HierarchyBranch, { nodes: visibleTree }) })), activePage.layout === 'timeline' && visibleRows.map((row) => (_jsxs("article", { className: "lp-preview__timeline-row", children: [_jsx("span", { className: `lp-preview__service-icon ${row.tone ? `lp-preview__service-icon--${row.tone}` : 'lp-preview__service-icon--neutral'}`, children: row.initial }), _jsxs("div", { children: [_jsx("b", { children: row.name }), _jsx("small", { children: row.detail }), _jsx("span", { className: "lp-preview__record-meta", children: row.meta })] }), _jsxs("span", { className: "lp-preview__timeline-time", children: [_jsx(Clock3, { size: 11 }), " ", row.status] })] }, row.name))), activePage.layout === 'security' && visibleRows.map((row) => (_jsxs("article", { className: "lp-preview__security-row", children: [_jsx("span", { className: `lp-preview__service-icon ${row.tone === 'amber' ? 'lp-preview__service-icon--amber' : 'lp-preview__service-icon--green'}`, children: row.tone === 'amber' ? _jsx(Clock3, { size: 13 }) : _jsx(Check, { size: 13 }) }), _jsxs("span", { children: [_jsx("b", { children: row.name }), _jsx("small", { children: row.detail })] }), _jsx("span", { className: `lp-preview__security-status ${row.tone === 'amber' ? 'lp-preview__security-status--amber' : ''}`, children: row.status })] }, row.name))), !hasVisibleContent && (_jsxs("p", { className: "lp-preview__empty", children: ["No ", activePage.label.toLowerCase(), " match \u201C", query, "\u201D."] }))] })] })] }), _jsxs("div", { className: "lp-preview__status", children: [_jsxs("span", { children: [_jsx("i", {}), " Workspace protected"] }), _jsxs("span", { children: [activePage.label, " \u00B7 Changes saved"] })] })] }) }));
}
