import Topbar from '../../components/ui/Topbar'
import VaultTree from './VaultTree'

export default function HierarchyPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Hierarchy', href: '/app/hierarchy' }]} />
      <div style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }}>
        <VaultTree />
      </div>
    </div>
  )
}
