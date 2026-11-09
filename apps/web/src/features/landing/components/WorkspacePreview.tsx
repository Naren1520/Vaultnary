import { useState, type ChangeEvent } from 'react'
import {
  Check,
  ChevronRight,
  Clock3,
  FolderKanban,
  GitBranch,
  KeyRound,
  LockKeyhole,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import './workspace-preview.css'

type PreviewPageId =
  | 'vault'
  | 'hierarchy'
  | 'projects'
  | 'services'
  | 'workspaces'
  | 'security'
  | 'audit'

type PreviewRow = {
  name: string
  detail: string
  meta: string
  status: string
  initial: string
  tone?: 'green' | 'amber'
}

type HierarchyNode = {
  name: string
  kind: string
  detail: string
  icon: LucideIcon
  tone?: 'green' | 'amber'
  children?: HierarchyNode[]
}

type PreviewPage = {
  id: PreviewPageId
  label: string
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  layout: 'table' | 'cards' | 'hierarchy' | 'timeline' | 'security'
  stats: { label: string; value: string }[]
  columns: [string, string, string]
  rows: PreviewRow[]
}

const pages: PreviewPage[] = [
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
]

const workspaceTree: HierarchyNode[] = [
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
]

function HierarchyBranch({ nodes, path = '' }: { nodes: HierarchyNode[]; path?: string }) {
  return (
    <ul className="lp-preview__tree">
      {nodes.map(({ name, kind, detail, icon: Icon, tone, children }) => {
        const nodePath = `${path}/${name}`
        return (
          <li className="lp-preview__tree-node" key={nodePath}>
            <div className="lp-preview__tree-card">
              <span className={`lp-preview__tree-icon ${tone ? `lp-preview__tree-icon--${tone}` : ''}`}>
                <Icon size={13} aria-hidden="true" />
              </span>
              <span className="lp-preview__tree-copy">
                <b>{name}</b>
                <small>{kind} · {detail}</small>
              </span>
              {children && <span className="lp-preview__tree-count">{children.length}</span>}
            </div>
            {children && <HierarchyBranch nodes={children} path={nodePath} />}
          </li>
        )
      })}
    </ul>
  )
}

function filterHierarchy(nodes: HierarchyNode[], query: string): HierarchyNode[] {
  const search = query.trim().toLowerCase()
  if (!search) return nodes

  return nodes.flatMap((node) => {
    const children = filterHierarchy(node.children ?? [], search)
    const matches = `${node.name} ${node.kind} ${node.detail}`.toLowerCase().includes(search)
    return matches || children.length > 0 ? [{ ...node, children }] : []
  })
}

export default function WorkspacePreview() {
  const [activePageId, setActivePageId] = useState<PreviewPageId>('vault')
  const [query, setQuery] = useState('')
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0]
  const visibleRows = activePage.rows.filter((row) =>
    `${row.name} ${row.detail} ${row.meta} ${row.status}`.toLowerCase().includes(query.toLowerCase()),
  )
  const visibleTree = filterHierarchy(workspaceTree, query)
  const hasVisibleContent = activePage.layout === 'hierarchy'
    ? visibleTree.length > 0
    : visibleRows.length > 0

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  return (
    <div className="lp-preview-wrap lp-reveal">
      <section className="lp-preview" aria-label="Interactive Vaultnary dashboard preview">
        <div className="lp-preview__topbar">
          <div className="lp-preview__dots" aria-hidden="true"><i /><i /><i /></div>
          <span>Vaultnary <span>/</span> {activePage.label}</span>
          <span className="lp-preview__avatar" aria-label="Signed in as Naren">N</span>
        </div>
        <div className="lp-preview__body">
          <aside className="lp-preview__sidebar" aria-label="Dashboard sections">
            <div className="lp-preview__workspace-mark"><LockKeyhole size={14} /></div>
            <span className="lp-preview__workspace-name">Acme Studio <ChevronRight size={12} /></span>
            <span className="lp-preview__nav-label">WORKSPACE</span>
            <nav className="lp-preview__nav" aria-label="Workspace dashboard">
              {pages.map(({ id, label, icon: Icon }) => (
                <button
                  aria-current={activePageId === id ? 'page' : undefined}
                  className={`lp-preview__nav-item ${activePageId === id ? 'lp-preview__nav-item--active' : ''}`}
                  key={id}
                  onClick={() => {
                    setActivePageId(id)
                    setQuery('')
                  }}
                  type="button"
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </aside>
          <div className="lp-preview__content" aria-live="polite">
            <div className="lp-preview__heading">
              <div>
                <span className="lp-preview__overline">{activePage.eyebrow}</span>
                <h3>{activePage.title}</h3>
              </div>
              <span className="lp-preview__add">+ New {activePage.id === 'vault' ? 'credential' : activePage.id === 'projects' ? 'project' : 'item'}</span>
            </div>
            <p className="lp-preview__description">{activePage.description}</p>
            <label className="lp-preview__search">
              <Search size={13} aria-hidden="true" />
              <input
                aria-label={`Search ${activePage.label.toLowerCase()}`}
                onChange={handleSearch}
                placeholder={`Search ${activePage.label.toLowerCase()}...`}
                type="search"
                value={query}
              />
              <kbd aria-hidden="true">⌘ K</kbd>
            </label>
            <div className="lp-preview__summary">
              {activePage.stats.map((stat) => (
                <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>
              ))}
            </div>
            <div className={`lp-preview__records lp-preview__records--${activePage.layout}`}>
              {activePage.layout === 'table' && (
                <>
                  <div className="lp-preview__list-header">
                    <span>NAME</span>
                    {activePage.columns.map((column) => <span key={column}>{column}</span>)}
                  </div>
                  {visibleRows.map((row) => (
                    <div className="lp-preview__row" key={row.name}>
                      <span className="lp-preview__credential">
                        <i className={`lp-preview__service-icon ${row.tone ? `lp-preview__service-icon--${row.tone}` : 'lp-preview__service-icon--neutral'}`}>{row.initial}</i>
                        <span><b>{row.name}</b></span>
                      </span>
                      <span className="lp-preview__project">{row.detail}</span>
                      <span className="lp-preview__project">{row.meta}</span>
                      <span className={`lp-preview__updated ${row.tone ? `lp-preview__updated--${row.tone}` : ''}`}>{row.status}</span>
                    </div>
                  ))}
                </>
              )}
              {activePage.layout === 'cards' && visibleRows.map((row) => (
                <article className="lp-preview__record-card" key={row.name}>
                  <span className={`lp-preview__service-icon ${row.tone ? `lp-preview__service-icon--${row.tone}` : 'lp-preview__service-icon--neutral'}`}>{row.initial}</span>
                  <b>{row.name}</b>
                  <small>{row.detail}</small>
                  <span className="lp-preview__record-meta">{row.meta}</span>
                  <span className="lp-preview__record-status">{row.status}</span>
                </article>
              ))}
              {activePage.layout === 'hierarchy' && (
                <div className="lp-preview__tree-view">
                  <HierarchyBranch nodes={visibleTree} />
                </div>
              )}
              {activePage.layout === 'timeline' && visibleRows.map((row) => (
                <article className="lp-preview__timeline-row" key={row.name}>
                  <span className={`lp-preview__service-icon ${row.tone ? `lp-preview__service-icon--${row.tone}` : 'lp-preview__service-icon--neutral'}`}>{row.initial}</span>
                  <div><b>{row.name}</b><small>{row.detail}</small><span className="lp-preview__record-meta">{row.meta}</span></div>
                  <span className="lp-preview__timeline-time"><Clock3 size={11} /> {row.status}</span>
                </article>
              ))}
              {activePage.layout === 'security' && visibleRows.map((row) => (
                <article className="lp-preview__security-row" key={row.name}>
                  <span className={`lp-preview__service-icon ${row.tone === 'amber' ? 'lp-preview__service-icon--amber' : 'lp-preview__service-icon--green'}`}>
                    {row.tone === 'amber' ? <Clock3 size={13} /> : <Check size={13} />}
                  </span>
                  <span><b>{row.name}</b><small>{row.detail}</small></span>
                  <span className={`lp-preview__security-status ${row.tone === 'amber' ? 'lp-preview__security-status--amber' : ''}`}>{row.status}</span>
                </article>
              ))}
              {!hasVisibleContent && (
                <p className="lp-preview__empty">No {activePage.label.toLowerCase()} match “{query}”.</p>
              )}
            </div>
          </div>
        </div>
        <div className="lp-preview__status"><span><i /> Workspace protected</span><span>{activePage.label} · Changes saved</span></div>
      </section>
    </div>
  )
}
