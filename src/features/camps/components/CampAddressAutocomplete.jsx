import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../../shared/api.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';
import { bindAutofillBlock } from '../../../shared/suppressBrowserAutofill.js';

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 300;

/**
 * Camp address search using server-side Google Places (New) autocomplete.
 */
export default function CampAddressAutocomplete({
  value = '',
  selectedPlaceId = '',
  manualOnly = false,
  placesAvailable = false,
  onChange,
  onPlaceSelected,
  onPlaceCleared,
  disabled = false,
  required = false,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const lastSelectedAddressRef = useRef('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [serviceDown, setServiceDown] = useState(false);
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);

  const useAutocomplete = placesAvailable && !manualOnly;
  const placeholder = manualOnly
    ? 'Enter camp / clinic address'
    : 'Search address — pick from suggestions';

  useEffect(() => {
    if (selectedPlaceId && value) {
      lastSelectedAddressRef.current = value;
    }
  }, [selectedPlaceId, value]);

  useEffect(() => {
    if (!useAutocomplete) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setServiceDown(false);
      return undefined;
    }

    const q = String(value || '').trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setLoading(false);
      setServiceDown(false);
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
        setServiceDown(false);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setOpen(false);
        setServiceDown(err?.code === 'PLACES_NOT_CONFIGURED' || err?.code === 'PLACES_AUTOCOMPLETE_FAILED');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, useAutocomplete]);

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
      const address = loc.campAddress || item.label || value;
      lastSelectedAddressRef.current = address;
      onChange?.(address);
      onPlaceSelected?.({
        ...loc,
        googlePlaceId: loc.googlePlaceId || item.placeId,
        zone,
        city: loc.city || loc.district || '',
      });
      setServiceDown(false);
    } catch {
      onChange?.(item.label || value);
      setServiceDown(true);
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

  function onInputChange(nextValue) {
    if (selectedPlaceId && nextValue !== lastSelectedAddressRef.current) {
      onPlaceCleared?.();
    }
    onChange?.(nextValue);
  }

  return (
    <div className="camp-address-autocomplete" ref={rootRef}>
      <input
        className="camp-address-legacy-input"
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        {...bindAutofillBlock({
          onFocus: () => {
            if (suggestions.length) setOpen(true);
          },
        })}
        {...(useAutocomplete ? {
          role: 'combobox',
          'aria-expanded': open,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
        } : {})}
      />
      {useAutocomplete && loading ? (
        <p className="muted camp-address-autocomplete-hint">Searching addresses…</p>
      ) : null}
      {useAutocomplete && open && suggestions.length ? (
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
      {useAutocomplete && serviceDown ? (
        <p className="muted camp-address-autocomplete-hint">
          Suggestions unavailable right now — use manual entry below if needed.
        </p>
      ) : null}
    </div>
  );
}
