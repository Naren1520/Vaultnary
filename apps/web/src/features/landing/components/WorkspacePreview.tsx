import {
  ChevronRight,
  FolderKanban,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'

export default function WorkspacePreview() {
  return (
    <div className="lp-preview-wrap lp-reveal" role="img" aria-label="Preview of the Vaultnary workspace">
      <div className="lp-preview">
        <div className="lp-preview__topbar">
          <div className="lp-preview__dots"><i /><i /><i /></div>
          <span>Vaultnary <span>/</span> Workspace</span>
          <span className="lp-preview__avatar">N</span>
        </div>
        <div className="lp-preview__body">
          <aside className="lp-preview__sidebar">
            <div className="lp-preview__workspace-mark"><LockKeyhole size={14} /></div>
            <span className="lp-preview__workspace-name">Acme Studio <ChevronRight size={12} /></span>
            <span className="lp-preview__nav-label">WORKSPACE</span>
            <span className="lp-preview__nav-item lp-preview__nav-item--active"><KeyRound size={14} /> Vault</span>
            <span className="lp-preview__nav-item"><FolderKanban size={14} /> Projects</span>
            <span className="lp-preview__nav-item"><Users size={14} /> Members</span>
            <div className="lp-preview__sidebar-bottom"><ShieldCheck size={14} /> Security</div>
          </aside>
          <div className="lp-preview__content">
            <div className="lp-preview__heading">
              <div><span className="lp-preview__overline">YOUR WORKSPACE</span><h3>Credential vault</h3></div>
              <span className="lp-preview__add">+ Add credential</span>
            </div>
            <div className="lp-preview__search"><Search size={13} /><span>Search credentials...</span><kbd>⌘ K</kbd></div>
            <div className="lp-preview__summary">
              <div><span>Credentials</span><strong>12</strong></div>
              <div><span>Projects</span><strong>04</strong></div>
              <div><span>Members</span><strong>06</strong></div>
            </div>
            <div className="lp-preview__list-header"><span>NAME</span><span>PROJECT</span><span>UPDATED</span></div>
            <div className="lp-preview__row">
              <span className="lp-preview__credential"><i className="lp-preview__service-icon lp-preview__service-icon--neutral">S</i><span><b>Production API</b><small>API credential</small></span></span>
              <span className="lp-preview__project">Platform</span><span className="lp-preview__updated">Just now</span>
            </div>
            <div className="lp-preview__row">
              <span className="lp-preview__credential"><i className="lp-preview__service-icon lp-preview__service-icon--green">D</i><span><b>Database access</b><small>Database credential</small></span></span>
              <span className="lp-preview__project">Platform</span><span className="lp-preview__updated">2 hours ago</span>
            </div>
            <div className="lp-preview__row">
              <span className="lp-preview__credential"><i className="lp-preview__service-icon lp-preview__service-icon--amber">G</i><span><b>Analytics account</b><small>Account credential</small></span></span>
              <span className="lp-preview__project">Growth</span><span className="lp-preview__updated">Yesterday</span>
            </div>
          </div>
        </div>
        <div className="lp-preview__status"><span><i /> Workspace protected</span><span>Changes saved</span></div>
      </div>
    </div>
  )
}
