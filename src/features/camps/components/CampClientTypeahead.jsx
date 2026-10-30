import { useEffect, useRef, useState } from 'react';
import { searchClientsWithMasters } from '../utils/searchClientsWithMasters.js';
import { useSearchDropdownKeyboard } from '../hooks/useSearchDropdownKeyboard';

/**
 * Single-select client typeahead (replaces bulk limit:500 client <select>).
 */
export function CampClientTypeahead({
  value = '',
  selectedLabel = '',
  onChange,
  disabled = false,
  required = false,
  hideLabel = false,
  allowedClients = null,
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayLabel, setDisplayLabel] = useState(selectedLabel || '');
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (selectedLabel) setDisplayLabel(selectedLabel);
  }, [selectedLabel, value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const allowedKey = Array.isArray(allowedClients)
    ? allowedClients.map((client) => String(client?._id || '')).join('|')
    : 'api';

  function runSearch(text) {
    const needle = String(text || '').trim().toLowerCase();
    if (Array.isArray(allowedClients)) {
      const rows = (needle
        ? allowedClients.filter((client) => String(client?.name || '').toLowerCase().includes(needle))
        : allowedClients
      ).slice(0, 40);
      setOptions(rows);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchClientsWithMasters(text, { limit: 40 })
      .then((rows) => setOptions(rows))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    runSearch('');
    // allowedKey refreshes local options when Method / Division changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey]);

  function onInput(e) {
    const next = e.target.value;
    setQuery(next);
    setDisplayLabel(next);
    setOpen(true);
    if (!String(next).trim() && value) onChange?.('', null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(next), 220);
  }

  function pick(client) {
    setDisplayLabel(client.name || '');
    setQuery('');
    setOpen(false);
    onChange?.(client._id, client);
  }

  const { activeIndex, setItemRef, getItemClassName, handleKeyDown } = useSearchDropdownKeyboard({
    open,
    itemCount: options.length,
    onSelectIndex: (idx) => {
      const row = options[idx];
      if (row) pick(row);
    },
    onClose: () => setOpen(false),
    onOpen: () => setOpen(true),
  });

  const input = (
    <input
      type="text"
      role="combobox"
      aria-label={hideLabel ? 'Client Name' : undefined}
      aria-expanded={open}
      aria-autocomplete="list"
      value={open ? (query || displayLabel) : displayLabel}
      onChange={onInput}
      onFocus={() => {
        setOpen(true);
        setQuery(displayLabel);
        if (!options.length) runSearch(displayLabel || '');
      }}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      required={required && !value}
      placeholder="Search client…"
      autoComplete="off"
    />
  );

  return (
    <div className="camp-client-typeahead" ref={wrapRef}>
      {hideLabel ? input : (
        <label>
          Client Name
          {input}
        </label>
      )}
      {open && !disabled ? (
        <ul className="camp-client-typeahead-list" role="listbox">
          {loading ? <li className="meta-text">Searching…</li> : null}
          {!loading && !options.length ? <li className="meta-text">No clients found</li> : null}
          {options.map((c, idx) => (
            <li key={c._id}>
              <button
                type="button"
                ref={(node) => setItemRef(idx, node)}
                className={getItemClassName(idx, 'camp-client-typeahead-item')}
                role="option"
                aria-selected={String(c._id) === String(value) || idx === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
