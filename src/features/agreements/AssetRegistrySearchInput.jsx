import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api.js';
import { assetSearchLabel } from './assetPlaceholderFields.js';

export default function AssetRegistrySearchInput({
  id,
  value,
  onChange,
  onSelectAsset,
  placeholder = 'Search Asset Registry by name, model, or serial…',
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const wrapperRef = useRef(null);
  const suppressOpenRef = useRef(false);

  function closeDropdown() {
    suppressOpenRef.current = true;
    setOpen(false);
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  }

  function openDropdown() {
    if (!suppressOpenRef.current) setOpen(true);
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

  useEffect(() => {
    if (!open) return undefined;
    const query = String(value || '').trim();
    if (query.length < 2) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api(`/assets?q=${encodeURIComponent(query)}&limit=15`);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, value]);

  const pickAsset = async (asset) => {
    closeDropdown();
    try {
      const { data: snapshot } = await api(`/assets/${asset._id}/placeholder-snapshot`);
      onSelectAsset?.({ ...snapshot, assetId: snapshot?.assetId || asset._id });
    } catch {
      onSelectAsset?.({
        assetId: asset._id,
        assetName: asset.deviceNameSnapshot || '',
        model: '',
        serialNumber: asset.serialNumber || '',
        assetTag: asset.assetTag || '',
      });
    }
  };

  return (
    <div className="asset-registry-search" ref={wrapperRef}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          openDropdown();
        }}
        onFocus={openDropdown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-listbox` : undefined}
      />
      {open && (loading || results.length > 0 || String(value || '').trim().length >= 2) && (
        <div
          className="asset-registry-search-dropdown"
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
        >
          {loading && <div className="asset-registry-search-empty">Searching…</div>}
          {!loading && results.length > 0 && (
            <>
              <div className="asset-registry-search-label">Asset Registry</div>
              {results.map((asset) => (
                <button
                  key={asset._id}
                  type="button"
                  role="option"
                  className="asset-registry-search-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickAsset(asset)}
                >
                  <strong>{asset.deviceNameSnapshot || asset.assetTag || 'Asset'}</strong>
                  <span className="muted">
                    {[asset.serialNumber, asset.assetTag, asset.custody].filter(Boolean).join(' · ') ||
                      'No serial'}
                  </span>
                </button>
              ))}
            </>
          )}
          {!loading && results.length === 0 && String(value || '').trim().length >= 2 && (
            <div className="asset-registry-search-empty">
              No matching assets. Try serial number or asset name.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AssetRegistryPickerSummary({ snapshot, onClear }) {
  if (!snapshot?.assetId) return null;
  return (
    <div className="asset-registry-picked">
      <div>
        <strong>{snapshot.assetName || assetSearchLabel(snapshot)}</strong>
        <div className="muted">
          {[snapshot.serialNumber, snapshot.model].filter(Boolean).join(' · ') || 'Linked asset'}
        </div>
      </div>
      {onClear ? (
        <button type="button" className="btn secondary btn-compact" onClick={onClear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}
