import { useEffect, useRef, useState } from 'react';
import { parseEmailList } from '../../../shared/validation.js';
import { clientMasterApi } from '../../camps/campOpsApi.js';
import { useSearchDropdownKeyboard } from '../../camps/hooks/useSearchDropdownKeyboard';

/**
 * Map a Client Master program (+ company billing) onto invoice bill-to / proforma recipient fields.
 * Contact Name always prefers program SPOC Name from Client Master.
 */
export function recipientPatchFromClientMaster(row) {
  if (!row) return null;
  const billing = row.billing || row.client || {};
  const name = String(row.clientName || billing.name || '').trim();
  const address = String(billing.address || '').trim();
  const contactPerson = String(
    row.spocName || billing.contactPerson || ''
  ).trim();
  const email =
    parseEmailList(row.spocEmail)[0] ||
    parseEmailList(billing.email)[0] ||
    '';
  const phone = String(row.spocNumber || billing.phone || '').trim();
  const projectName = String(row.programName || row.campName || '').trim();

  return {
    clientMasterId: row._id ? String(row._id) : '',
    clientId: row.clientId ? String(row.clientId) : '',
    billTo: {
      name,
      address,
      stateName: String(billing.stateName || '').trim(),
      stateCode: String(billing.stateCode || '').trim(),
      gstin: String(billing.gstin || '').trim(),
      pan: String(billing.pan || '').trim(),
      contactPerson,
      email,
      phone,
    },
    recipient: {
      name,
      placeOfSupply: address,
      deliveryAddress: address,
      stateCode: String(billing.stateCode || '').trim(),
      recipientGstin: String(billing.gstin || '').trim(),
      recipientPan: String(billing.pan || '').trim(),
      contactPerson,
      contactEmail: email,
      projectName,
    },
    projectName,
  };
}

function optionLabel(row) {
  const code = String(row.clientCode || '').trim() || '—';
  const division = String(row.programName || row.drugTherapyName || '').trim() || '—';
  return `${code} · ${division}`;
}

/**
 * Typeahead Client Master pick (replaces bulk limit:500 bootstrap).
 */
export default function ClientMasterRecipientPicker({
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
    clientMasterApi
      .list({ ...(q ? { q } : {}), limit: 40, page: 1 })
      .then(({ data }) => {
        const list = data?.data || data?.pagination?.data || [];
        setRows(Array.isArray(list) ? list.filter((r) => r.isActive !== false) : []);
        setError('');
      })
      .catch((err) => {
        setRows([]);
        setError(err?.message || 'Could not load Client Master');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    runSearch('');
  }, []);

  useEffect(() => {
    if (!value) {
      setDisplayLabel('');
      return;
    }
    const match = rows.find((r) => String(r._id) === String(value));
    if (match) setDisplayLabel(optionLabel(match));
  }, [value, rows]);

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
    onPick?.(row, recipientPatchFromClientMaster(row));
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

  return (
    <div className="ib-client-master-pick camp-client-typeahead" ref={wrapRef}>
      <label>
        Client Master
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Pick recipient from Client Master"
          disabled={disabled}
          value={displayLabel}
          placeholder={loading ? 'Loading…' : 'Search Client Master…'}
          onChange={onInput}
          onFocus={() => {
            setOpen(true);
            if (!rows.length) runSearch(query);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </label>
      {open && (
        <ul className="camp-client-typeahead-menu" role="listbox">
          {loading && <li className="camp-client-typeahead-empty">Searching…</li>}
          {!loading && !rows.length && (
            <li className="camp-client-typeahead-empty">No Client Master records</li>
          )}
          {rows.map((row, idx) => (
            <li
              key={String(row._id)}
              ref={setItemRef(idx)}
              role="option"
              aria-selected={String(row._id) === String(value)}
              className={getItemClassName(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(row);
              }}
            >
              {optionLabel(row)}
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="ib-client-master-pick-error">{error}</p> : null}
    </div>
  );
}
