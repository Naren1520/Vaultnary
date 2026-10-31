import { useEffect, useState } from 'react'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet, apiDelete } from '../../services/http-client'

interface UsageRecord {
  id: string
  item_id: string
  project_id: string | null
  service_id: string | null
  notes: string | null
  created_at: string
}

interface UsageResponse {
  data: UsageRecord[]
}

interface UsageDetailProps {
  itemId: string
}

const columns: Column<UsageRecord>[] = [
  {
    key: 'target',
    header: 'Linked to',
    render: (r) => (
      <span style={{ fontSize: 'var(--text-sm)' }}>
        {r.project_id ? `Project: ${r.project_id}` : r.service_id ? `Service: ${r.service_id}` : '—'}
      </span>
    ),
  },
  {
    key: 'notes',
    header: 'Notes',
    render: (r) => (
      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        {r.notes ?? '—'}
      </span>
    ),
  },
  {
    key: 'created_at',
    header: 'Added',
    render: (r) => (
      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
        {new Date(r.created_at).toLocaleDateString()}
      </span>
    ),
    width: '8rem',
  },
]

export default function UsageDetail({ itemId }: UsageDetailProps) {
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<UsageResponse>(`/api/v1/vault/items/${itemId}/usage`, { signal: ctrl.signal })
      .then((r) => setRecords(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [itemId])

  async function handleDelete(usageId: string) {
    await apiDelete(`/api/v1/vault/items/${itemId}/usage/${usageId}`)
    setRecords((prev) => prev.filter((r) => r.id !== usageId))
  }

  const cols: Column<UsageRecord>[] = [
    ...columns,
    {
      key: 'actions',
      header: '',
      width: '5rem',
      render: (r) => (
        <button
          onClick={() => void handleDelete(r.id)}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px var(--space-2)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          }}
        >
          Remove
        </button>
      ),
    },
  ]

  if (loading) return <SkeletonLoader variant="table-row" rows={3} />

  return (
    <DataTable
      columns={cols}
      rows={records}
      getRowKey={(r) => r.id}
      caption="Usage links"
      emptyState={
        <EmptyState
          title="No usage links"
          message="Link this credential to a project or service to track where it is used."
        />
      }
    />
  )
}
