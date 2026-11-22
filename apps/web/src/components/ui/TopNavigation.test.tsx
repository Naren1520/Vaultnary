import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import TopNavigation from './TopNavigation'

describe('TopNavigation', () => {
  it('shows only Workspace, Security, and Profile and keeps Workspace active in nested pages', () => {
    render(
      <MemoryRouter initialEntries={['/app/workspaces/workspace-1/projects']}>
        <TopNavigation />
      </MemoryRouter>,
    )

    expect(within(screen.getByRole('navigation', { name: 'Primary navigation' }))
      .getAllByRole('link')
      .map((link) => link.textContent?.trim()))
      .toEqual(['Workspace', 'Security', 'Profile'])
    expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Security' })).not.toHaveAttribute('aria-current')
  })
})
