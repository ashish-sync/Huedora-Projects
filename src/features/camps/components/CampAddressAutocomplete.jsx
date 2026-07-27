import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../../shared/api.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 300;

/**
 * Camp address search using server-side Google Places (New) autocomplete.
 * Avoids loading Maps JavaScript in the browser (referrer/key restrictions).
 */
export default function CampAddressAutocomplete({
  value = '',
  onChange,
  onPlaceSelected,
  disabled = false,
  required = false,
  placeholder = 'Start typing address…',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState('ready'); // ready | unavailable | not_configured
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = String(value || '').trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setLoading(false);
      return undefined;
    }

    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setLoading(true);
      try {
        const json = await api(`/geo/places/autocomplete?input=${encodeURIComponent(q)}`);
        if (seq !== requestSeq.current) return;
        const rows = Array.isArray(json.data) ? json.data : [];
        setSuggestions(rows);
        setOpen(rows.length > 0);
        setActiveIndex(-1);
        setStatus('ready');
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setOpen(false);
        if (err?.code === 'PLACES_NOT_CONFIGURED') {
          setStatus('not_configured');
        } else {
          setStatus('unavailable');
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function selectSuggestion(item) {
    if (!item?.placeId) return;
    setOpen(false);
    setSuggestions([]);
    try {
      const json = await api(`/geo/places/details?placeId=${encodeURIComponent(item.placeId)}`);
      const loc = json.data || {};
      const zone = resolveZoneForState(loc.state) || '';
      onChange?.(loc.campAddress || item.label || value);
      onPlaceSelected?.({
        ...loc,
        zone,
        city: loc.city || loc.district || '',
      });
      setStatus('ready');
    } catch {
      onChange?.(item.label || value);
      setStatus('unavailable');
    }
  }

  function onKeyDown(event) {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="camp-address-autocomplete" ref={rootRef}>
      <input
        className="camp-address-legacy-input"
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {loading ? (
        <p className="muted camp-address-autocomplete-hint">Searching addresses…</p>
      ) : null}
      {open && suggestions.length ? (
        <ul id={listId} className="camp-address-suggestions" role="listbox">
          {suggestions.map((item, index) => (
            <li key={item.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                <span className="camp-address-suggestion-main">{item.label}</span>
                {item.secondaryText ? (
                  <span className="camp-address-suggestion-sub">{item.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status === 'not_configured' ? (
        <p className="muted camp-address-autocomplete-hint">
          Google Places is not configured — enter the address manually.
        </p>
      ) : null}
      {status === 'unavailable' ? (
        <p className="muted camp-address-autocomplete-hint">
          Address suggestions unavailable — you can still type the address manually.
        </p>
      ) : null}
      {status === 'ready' && !loading ? (
        <p className="muted camp-address-autocomplete-hint">Search an address, then edit the fields below if needed.</p>
      ) : null}
    </div>
  );
}
