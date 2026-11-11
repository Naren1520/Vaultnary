import Topbar from '../../components/ui/Topbar'
import VaultTree from './VaultTree'

export default function HierarchyPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Hierarchy', href: '/app/hierarchy' }]} />
      <div className="app-page-content" style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }}>
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Explore your vault</p>
          <h1>Hierarchy</h1>
          <p>Browse credentials through their folder and parent-child relationships.</p>
        </header>
        <VaultTree />
      </div>
    </div>
  )
}
