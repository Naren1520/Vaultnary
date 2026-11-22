import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import TopNavigation from './TopNavigation';
describe('TopNavigation', () => {
    it('shows only Workspace, Security, and Profile and keeps Workspace active in nested pages', () => {
        render(_jsx(MemoryRouter, { initialEntries: ['/app/workspaces/workspace-1/projects'], children: _jsx(TopNavigation, {}) }));
        expect(within(screen.getByRole('navigation', { name: 'Primary navigation' }))
            .getAllByRole('link')
            .map((link) => link.textContent?.trim()))
            .toEqual(['Workspace', 'Security', 'Profile']);
        expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Security' })).not.toHaveAttribute('aria-current');
    });
});
