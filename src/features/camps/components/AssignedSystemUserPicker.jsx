import { useEffect, useMemo, useRef, useState } from 'react';
import { bindAutofillBlock } from '../../../shared/suppressBrowserAutofill.js';
import { parseEmailList } from '../../../shared/validation.js';
import { userApi } from '../campOpsApi.js';
import { useSearchDropdownKeyboard } from '../hooks/useSearchDropdownKeyboard';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function userLabel(user) {
  const name = String(user?.fullName || user?.name || '').trim();
  const email = String(user?.email || '').trim();
  if (name && email) return `${name} · ${email}`;
  return name || email || 'User';
}

/**
 * Multi-select typeahead for system users. Stores comma-separated login emails
 * (same payload as before) while letting admins pick by name or email.
 */
export function AssignedSystemUserPicker({
  value = '',
  onChange,
  error = '',
  disabled = false,
}) {
  const selectedEmails = useMemo(() => parseEmailList(value), [value]);
  const selectedSet = useMemo(
    () => new Set(selectedEmails.map(normalizeEmail)),
    [selectedEmails],
  );

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [labelsByEmail, setLabelsByEmail] = useState(() => new Map());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const suppressOpenRef = useRef(false);

  function closeDropdown() {
    suppressOpenRef.current = true;
    setOpen(false);
    setSuggestions([]);
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  }

  function openDropdown() {
    if (!suppressOpenRef.current) setOpen(true);
  }

  function emitEmails(nextEmails) {
    const unique = [];
    const seen = new Set();
    for (const email of nextEmails) {
      const key = normalizeEmail(email);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(String(email).trim());
    }
    onChange(unique.join(', '));
  }

  function rememberUser(user) {
    const email = normalizeEmail(user?.email);
    if (!email) return;
    setLabelsByEmail((prev) => {
      if (prev.get(email) === userLabel(user)) return prev;
      const next = new Map(prev);
      next.set(email, userLabel(user));
      return next;
    });
  }

  function addUser(user) {
    const email = String(user?.email || '').trim();
    if (!email) return;
    rememberUser(user);
    if (selectedSet.has(normalizeEmail(email))) {
      setQuery('');
      closeDropdown();
      return;
    }
    emitEmails([...selectedEmails, email]);
    setQuery('');
    closeDropdown();
  }

  function removeEmail(email) {
    const key = normalizeEmail(email);
    emitEmails(selectedEmails.filter((item) => normalizeEmail(item) !== key));
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Resolve display labels for already-selected emails (edit form load).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const updates = new Map();
      await Promise.all(
        selectedEmails.map(async (email) => {
          const key = normalizeEmail(email);
          if (!key) return;
          try {
            const res = await userApi.list({ q: email, limit: 10, page: 1 });
            const rows = res?.data?.data || [];
            const match = rows.find((row) => normalizeEmail(row.email) === key);
            updates.set(key, match ? userLabel(match) : email);
          } catch {
            updates.set(key, email);
          }
        }),
      );
      if (cancelled || !updates.size) return;
      setLabelsByEmail((prev) => {
        let changed = false;
        const next = new Map(prev);
        updates.forEach((label, key) => {
          if (next.get(key) === label) return;
          next.set(key, label);
          changed = true;
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEmails]);

  useEffect(() => {
    if (!open) return undefined;

    const needle = String(query || '').trim();
    if (needle.length < 1) {
      setSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await userApi.list({ q: needle, limit: 15, page: 1, activeOnly: 1 });
        const rows = (res?.data?.data || []).filter(
          (row) => row?.email && row.isActive !== false && !selectedSet.has(normalizeEmail(row.email)),
        );
        setSuggestions(rows);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, open, selectedSet]);

  const {
    setItemRef,
    getItemClassName,
    handleKeyDown,
  } = useSearchDropdownKeyboard({
    open: open && !loading && suggestions.length > 0,
    itemCount: suggestions.length,
    onSelectIndex: (index) => addUser(suggestions[index]),
    onClose: closeDropdown,
    onOpen: openDropdown,
    resetDeps: [query, suggestions.length, loading],
  });

  return (
    <div className="assigned-user-picker" ref={wrapperRef}>
      {selectedEmails.length > 0 && (
        <div className="assigned-user-picker-chips" aria-label="Selected system users">
          {selectedEmails.map((email) => {
            const key = normalizeEmail(email);
            const label = labelsByEmail.get(key) || email;
            return (
              <span key={key} className="filter-chip assigned-user-picker-chip" title={email}>
                {label}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => removeEmail(email)}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      <div className="client-search-field tylo-combobox-field">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            openDropdown();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !query && selectedEmails.length) {
              removeEmail(selectedEmails[selectedEmails.length - 1]);
              return;
            }
            handleKeyDown(event);
          }}
          placeholder={selectedEmails.length ? 'Add another user…' : 'Type name or email to select a system user'}
          disabled={disabled}
          {...bindAutofillBlock({
            onFocus: openDropdown,
          })}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Search system users"
          title="Search by full name or login email. Selected users only see camps for this Client."
          className={error ? 'input-invalid' : ''}
        />
        <span className="tylo-dropdown-chevron tylo-combobox-chevron" aria-hidden="true" />
        {open && String(query || '').trim().length >= 1 && (
          <div className="client-search-dropdown" role="listbox">
            {loading && <div className="client-search-item muted">Searching…</div>}
            {!loading && suggestions.length === 0 && (
              <div className="client-search-item muted">No matching system users</div>
            )}
            {!loading && suggestions.map((user, index) => (
              <button
                key={user._id || user.email}
                ref={(node) => setItemRef(index, node)}
                type="button"
                role="option"
                className={getItemClassName(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addUser(user)}
              >
                <strong>{user.fullName || user.name || user.email}</strong>
                <span>{user.email}{user.role && user.role !== '—' ? ` · ${user.role}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
