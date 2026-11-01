import { useEffect, useId, useRef, useState } from 'react';
import { bindAutofillBlock } from '../../../shared/suppressBrowserAutofill.js';

const MIN_QUERY_LEN = 3;
const DEBOUNCE_MS = 400;

/**
 * Public Camp Request Form address search via server-side Ola Maps Autocomplete.
 * The Ola API key never leaves the server.
 */
export default function PublicOlaAddressAutocomplete({
  value = '',
  selectedPlaceId = '',
  lookup,
  onChange,
  disabled = false,
  required = false,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const lastSelectedAddressRef = useRef('');
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (selectedPlaceId && value) lastSelectedAddressRef.current = value;
  }, [selectedPlaceId, value]);

  useEffect(() => {
    const q = String(value || '').trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!lookup?.autocomplete || q.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setLoading(false);
      setStatus('');
      return undefined;
    }

    if (selectedPlaceId && q === lastSelectedAddressRef.current) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setStatus('');
      return undefined;
    }

    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setStatus('Searching addresses…');
      try {
        const rows = await lookup.autocomplete(q);
        if (seq !== requestSeq.current) return;
        const list = Array.isArray(rows) ? rows : [];
        setSuggestions(list);
        setOpen(true);
        setActiveIndex(-1);
        setStatus(list.length ? '' : 'No matching addresses — type the full address');
      } catch {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setOpen(false);
        setStatus('Suggestions unavailable — you can type the address');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, lookup, selectedPlaceId]);

  useEffect(() => {
    function onDocPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, []);

  function emitManual(nextValue) {
    onChange?.({
      campAddress: nextValue,
      addressManualEntry: true,
      googlePlaceId: '',
      latitude: '',
      longitude: '',
    });
  }

  function selectSuggestion(item) {
    if (!item) return;
    const address = item.campAddress || item.label || value;
    lastSelectedAddressRef.current = address;
    setOpen(false);
    setSuggestions([]);
    setStatus('');
    onChange?.({
      campAddress: address,
      addressManualEntry: false,
      googlePlaceId: item.placeId || '',
      latitude: item.latitude || '',
      longitude: item.longitude || '',
    });
    inputRef.current?.blur();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
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
    }
  }

  const showList = open && (suggestions.length > 0 || (!loading && Boolean(status)));

  return (
    <div className="camp-address-autocomplete public-ola-address" ref={rootRef}>
      <input
        ref={inputRef}
        className="camp-address-input"
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => emitManual(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search or type camp / clinic address"
        enterKeyHint="search"
        inputMode="text"
        {...bindAutofillBlock({
          onFocus: () => {
            if (suggestions.length || status) setOpen(true);
          },
        })}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && suggestions[activeIndex]
            ? `${listId}-opt-${activeIndex}`
            : undefined
        }
      />
      {loading ? (
        <p className="public-ola-address__hint" role="status">Searching addresses…</p>
      ) : null}
      {showList ? (
        <ul
          id={listId}
          className="camp-address-suggestions public-ola-address__list"
          role="listbox"
        >
          {suggestions.map((item, index) => (
            <li key={item.placeId || `${item.label}-${index}`}>
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'is-active' : ''}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                <span className="camp-address-suggestion-main">{item.label}</span>
                {item.secondaryText ? (
                  <span className="camp-address-suggestion-sub">{item.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
          {!suggestions.length && status ? (
            <li className="public-ola-address__empty" role="status">{status}</li>
          ) : null}
        </ul>
      ) : null}
      {!loading && status && !showList ? (
        <p className="public-ola-address__hint" role="status">{status}</p>
      ) : null}
    </div>
  );
}
