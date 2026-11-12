import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CredentialBadge from '../../components/ui/CredentialBadge';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { apiGet } from '../../services/http-client';
import { useVaultStore } from '../../state/vault-store';
import { decryptVaultMetadata } from '../vault/metadata';
const DEBOUNCE_MS = 300;
/**
 * Global search dropdown.
 * - 300ms debounce on query changes
 * - Shows SkeletonLoader while fetching
 * - Renders CredentialBadge + name for each result
 * - Clicking a result navigates to /app/vault/:itemId
 * - Hides when query is empty or results are empty after fetch
 */
export default function GlobalSearch({ query, onQueryChange }) {
    const navigate = useNavigate();
    const { isUnlocked: isVaultUnlocked, privateKey } = useVaultStore();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    /* Debounced search */
    useEffect(() => {
        if (!isVaultUnlocked || !privateKey || !query.trim()) {
            setResults([]);
            setOpen(false);
            setLoading(false);
            return;
        }
        setLoading(true);
        setOpen(true);
        let cancelled = false;
        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const res = await apiGet(`/api/v1/vault/search?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal });
                const decrypted = await Promise.all(res.data.map((item) => decryptVaultMetadata(item, privateKey)));
                if (cancelled)
                    return;
                const search = query.trim().toLocaleLowerCase();
                const matches = decrypted
                    .filter((item) => !item.legacy)
                    .filter((item) => [item.name, item.credential_type, ...item.tags]
                    .some((value) => value.toLocaleLowerCase().includes(search)))
                    .map(({ id, name, credential_type }) => ({
                    id,
                    name,
                    credential_type,
                }));
                setResults(matches);
                setOpen(matches.length > 0);
            }
            catch {
                if (!cancelled)
                    setResults([]);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }, DEBOUNCE_MS);
        return () => {
            cancelled = true;
            ctrl.abort();
            clearTimeout(timer);
        };
    }, [isVaultUnlocked, privateKey, query]);
    /* Close dropdown when clicking outside */
    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    function handleResultClick(id) {
        setOpen(false);
        onQueryChange('');
        navigate(`/app/vault/${id}`);
    }
    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            setOpen(false);
            onQueryChange('');
        }
    }
    const showDropdown = open && query.trim().length > 0;
    if (!isVaultUnlocked) {
        return (_jsx("input", { type: "search", value: "", disabled: true, placeholder: "Unlock vault to search", "aria-label": "Unlock the vault to search", style: {
                width: '100%',
                padding: 'var(--space-1) var(--space-3)',
                border: 'var(--border-input)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                backgroundColor: 'var(--color-bg-subtle)',
                color: 'var(--color-text-muted)',
            } }));
    }
    return (_jsxs("div", { ref: containerRef, className: "global-search", children: [_jsx("input", { type: "search", value: query, onChange: (e) => onQueryChange(e.target.value), onKeyDown: handleKeyDown, onFocus: () => { if (results.length > 0)
                    setOpen(true); }, placeholder: "Search vault\u2026", "aria-label": "Search vault", "aria-expanded": showDropdown, "aria-haspopup": "listbox", style: {
                    width: '100%',
                    padding: 'var(--space-1) var(--space-3)',
                    border: 'var(--border-input)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-text)',
                    boxSizing: 'border-box',
                } }), showDropdown && (_jsx("div", { role: "listbox", "aria-label": "Search results", style: {
                    position: 'absolute',
                    top: 'calc(100% + var(--space-1))',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--color-bg)',
                    border: 'var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    zIndex: 200,
                    overflow: 'hidden',
                    maxHeight: '20rem',
                    overflowY: 'auto',
                }, children: loading ? (_jsx("div", { style: { padding: 'var(--space-3)' }, children: _jsx(SkeletonLoader, { variant: "search-result", rows: 3 }) })) : (results.map((result) => (_jsxs("button", { role: "option", "aria-selected": false, onClick: () => handleResultClick(result.id), style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text)',
                        fontSize: 'var(--text-sm)',
                        cursor: 'pointer',
                        borderBottom: 'var(--border-card)',
                    }, onMouseEnter: (e) => {
                        ;
                        e.currentTarget.style.backgroundColor =
                            'var(--color-bg-subtle)';
                    }, onMouseLeave: (e) => {
                        ;
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }, children: [_jsx(CredentialBadge, { type: result.credential_type, showLabel: false, size: "sm" }), _jsx("span", { style: {
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }, children: result.name })] }, result.id)))) }))] }));
}
