import Topbar from '../../components/ui/Topbar'
import Inspector from '../../components/ui/Inspector'
import EmptyState from '../../components/feedback/EmptyState'
import VaultList from './VaultList'

export default function VaultPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Topbar breadcrumbs={[{ label: 'Vault', href: '/app/vault' }]} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          <VaultList />
        </div>
        <Inspector>
          <EmptyState title="Select an item" message="Click a credential to view its details." />
        </Inspector>
      </div>
    </div>
  )
}
