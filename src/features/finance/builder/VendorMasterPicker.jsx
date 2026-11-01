import { useEffect, useRef, useState } from 'react';
import { gstStateCodeForName } from '../../camps/utils/indiaGstStateCodes.js';
import { useSearchDropdownKeyboard } from '../../camps/hooks/useSearchDropdownKeyboard';
import { vendorMasterApi } from './vendorMasterApi.js';

/**
 * Map a Master One vendor onto Purchase Order / vendor-bill fields.
 */
export function vendorPatchFromMaster(row) {
  if (!row) return null;
  const name = String(row.name || '').trim();
  const city = String(row.city || '').trim();
  const stateName = String(row.state || '').trim();
  const address = String(row.address || '').trim() || [city, stateName].filter(Boolean).join(', ');
  const gstin = String(row.gstin || '').trim();
  const stateCode =
    String(row.stateCode || '').trim() ||
    gstStateCodeForName(stateName) ||
    (gstin.length >= 2 ? gstin.slice(0, 2) : '');

  return {
    vendorMasterId: row._id ? String(row._id) : '',
    contactId: row.contactId ? String(row.contactId) : '',
    vendor: {
      name,
      code: String(row.code || '').trim(),
      address,
      gstin,
      pan: String(row.panCard || '').trim(),
      stateName,
      stateCode,
      contactPerson: String(row.contactName || '').trim(),
      mobile: String(row.phone || '').trim(),
      email: String(row.email || '').trim(),
    },
    vendorName: name,
  };
}

function optionLabel(row) {
  const code = String(row.code || '').trim() || '—';
  const name = String(row.name || '').trim() || 'Unnamed';
  const supply = String(row.supplyCategory || '').trim();
  return supply ? `${code} · ${name} · ${supply}` : `${code} · ${name}`;
}

/**
 * Typeahead Vendor Master pick — same control pattern as Client Master.
 */
export default function VendorMasterPicker({
  value = '',
  onPick,
  onClear,
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [displayLabel, setDisplayLabel] = useState('');
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  function runSearch(text) {
    setLoading(true);
    const q = String(text || '').trim();
    vendorMasterApi
      .list({ ...(q ? { q } : {}), limit: 40, page: 1 })
      .then((res) => {
        const list = res?.data || [];
        setRows(Array.isArray(list) ? list.filter((r) => r.isActive !== false) : []);
        setError('');
      })
      .catch((err) => {
        setRows([]);
        setError(err?.message || 'Could not load Vendor Master');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    runSearch('');
  }, []);

  useEffect(() => {
    if (open) return;
    if (!value) {
      setDisplayLabel('');
      setQuery('');
      return;
    }
    const match = rows.find((r) => String(r._id) === String(value));
    if (match) {
      setDisplayLabel(optionLabel(match));
      setQuery('');
      return;
    }
    let cancelled = false;
    vendorMasterApi
      .get(value)
      .then((res) => {
        if (cancelled) return;
        const row = res?.data || res;
        if (row && String(row._id) === String(value)) {
          setDisplayLabel(optionLabel(row));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value, rows, open]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function onInput(e) {
    const next = e.target.value;
    setQuery(next);
    setDisplayLabel(next);
    setOpen(true);
    if (value) onClear?.();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(next), 220);
  }

  function pick(row) {
    setDisplayLabel(optionLabel(row));
    setQuery('');
    setOpen(false);
    onPick?.(row, vendorPatchFromMaster(row));
  }

  const { activeIndex, setItemRef, getItemClassName, handleKeyDown } = useSearchDropdownKeyboard({
    open,
    itemCount: rows.length,
    onSelectIndex: (idx) => {
      const row = rows[idx];
      if (row) pick(row);
    },
    onClose: () => setOpen(false),
    onOpen: () => setOpen(true),
  });

  const inputValue = open ? (query || displayLabel) : displayLabel;

  return (
    <div className="ib-client-master-pick ib-client-master-typeahead" ref={wrapRef}>
      <input
        type="text"
        className="ib-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label="Pick vendor from Vendor Master"
        disabled={disabled}
        value={inputValue}
        placeholder={loading && !rows.length ? 'Loading…' : 'Search Vendor Master…'}
        onChange={onInput}
        onFocus={() => {
          setOpen(true);
          setQuery(displayLabel);
          if (!rows.length) runSearch(query || displayLabel || '');
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && !disabled ? (
        <ul className="ib-client-master-typeahead-menu" role="listbox">
          {loading ? (
            <li className="ib-client-master-typeahead-empty">Searching…</li>
          ) : null}
          {!loading && !rows.length ? (
            <li className="ib-client-master-typeahead-empty">No Vendor Master records</li>
          ) : null}
          {rows.map((row, idx) => (
            <li key={String(row._id)}>
              <button
                type="button"
                ref={(node) => setItemRef(idx, node)}
                role="option"
                aria-selected={String(row._id) === String(value) || idx === activeIndex}
                className={getItemClassName(idx, 'ib-client-master-typeahead-item')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                {optionLabel(row)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="ib-client-master-pick-error">{error}</p> : null}
    </div>
  );
}
