import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
}));
vi.mock('../../services/http-client', () => ({
    apiPost: mocks.apiPost,
}));
import ContactPage from './ContactPage';
import SupportPage from './SupportPage';
describe('Company pages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, 'scrollTo').mockImplementation(() => { });
        mocks.apiPost.mockResolvedValue({ message: 'Your message has been sent.' });
    });
    it('submits the contact form and confirms success', async () => {
        render(_jsx(MemoryRouter, { children: _jsx(ContactPage, {}) }));
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } });
        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } });
        fireEvent.change(screen.getByLabelText('What can we help with?'), {
            target: { value: 'General question' },
        });
        fireEvent.change(screen.getByRole('textbox', { name: /Your message/ }), {
            target: { value: 'I would like to learn more about Vaultnary.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/contact', {
                name: 'Alex',
                email: 'alex@example.com',
                topic: 'General question',
                message: 'I would like to learn more about Vaultnary.',
            });
        });
        expect(await screen.findByRole('status')).toHaveTextContent('Your message is on its way.');
    });
    it('shows an error when the contact request fails', async () => {
        mocks.apiPost.mockRejectedValueOnce(new Error('Unavailable'));
        render(_jsx(MemoryRouter, { children: _jsx(ContactPage, {}) }));
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } });
        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } });
        fireEvent.change(screen.getByLabelText('What can we help with?'), {
            target: { value: 'General question' },
        });
        fireEvent.change(screen.getByRole('textbox', { name: /Your message/ }), {
            target: { value: 'I would like to learn more about Vaultnary.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t send your message.');
    });
    it('filters support FAQs by question and answer', () => {
        render(_jsx(MemoryRouter, { children: _jsx(SupportPage, {}) }));
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search help articles' }), {
            target: { value: 'master password' },
        });
        expect(screen.getByText(/I forgot my vault master password/)).toBeInTheDocument();
        expect(screen.queryByText('How do I create a Vaultnary account?')).not.toBeInTheDocument();
    });
});
