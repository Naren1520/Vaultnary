import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-1)',
          listStyle: 'none',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li
              key={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
            >
              {index > 0 && (
                <span aria-hidden="true" style={{ color: 'var(--color-border)' }}>
                  /
                </span>
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  style={{ color: 'var(--color-text)', fontWeight: 'var(--font-weight-medium)' }}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  style={{
                    color: 'var(--color-text-muted)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.color =
                      'var(--color-accent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.color =
                      'var(--color-text-muted)'
                  }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
