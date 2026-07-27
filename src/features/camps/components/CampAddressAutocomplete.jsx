import { useEffect, useRef, useState } from 'react';
import { useGoogleMapsPlaces } from '../../../shared/googleMaps/useGoogleMapsPlaces.js';
import { parseGooglePlace } from '../../../shared/googleMaps/parseGooglePlace.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';

function emitPlaceSelection(place, onChange, onPlaceSelected) {
  const parsed = parseGooglePlace(place);
  if (!parsed) return;
  const zone = resolveZoneForState(parsed.state) || '';
  onChange?.(parsed.campAddress);
  onPlaceSelected?.({
    ...parsed,
    zone,
    city: parsed.city || parsed.district || '',
  });
}

/**
 * Camp address search with Google Places (new PlaceAutocompleteElement, legacy Autocomplete fallback).
 */
export default function CampAddressAutocomplete({
  value = '',
  onChange,
  onPlaceSelected,
  disabled = false,
  required = false,
  placeholder = 'Start typing address…',
}) {
  const hostRef = useRef(null);
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onChangeRef.current = onChange;
  onPlaceSelectedRef.current = onPlaceSelected;

  const { isReady, isDisabled, hasError } = useGoogleMapsPlaces();
  const [mode, setMode] = useState('loading'); // loading | widget | legacy | manual

  useEffect(() => {
    if (isDisabled || hasError) {
      setMode('manual');
      return undefined;
    }
    if (!isReady || disabled || !hostRef.current) {
      return undefined;
    }

    let cancelled = false;
    let widget = null;
    let legacyAutocomplete = null;
    let legacyListener = null;
    let legacyInput = null;

    const cleanup = () => {
      if (legacyListener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(legacyListener);
      }
      if (legacyInput?.parentNode) {
        legacyInput.parentNode.removeChild(legacyInput);
      }
      if (widget?._tyloSelectHandler) {
        widget.removeEventListener('gmp-placeselect', widget._tyloSelectHandler);
      }
      if (widget?.parentNode) {
        widget.parentNode.removeChild(widget);
      }
      if (hostRef.current) {
        hostRef.current.innerHTML = '';
      }
    };

    (async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
        if (cancelled || !hostRef.current) return;

        widget = new PlaceAutocompleteElement({
          componentRestrictions: { country: ['in'] },
          requestedLanguage: 'en',
        });
        widget.classList.add('camp-place-autocomplete-widget');
        widget.placeholder = placeholder;
        hostRef.current.appendChild(widget);
        setMode('widget');

        const onSelect = async (event) => {
          try {
            const place = event.place;
            await place.fetchFields({
              fields: ['addressComponents', 'formattedAddress', 'location', 'displayName'],
            });
            emitPlaceSelection(place, onChangeRef.current, onPlaceSelectedRef.current);
          } catch {
            /* keep manual fields editable */
          }
        };
        widget.addEventListener('gmp-placeselect', onSelect);
        widget._tyloSelectHandler = onSelect;
        return;
      } catch {
        /* fall through to legacy autocomplete */
      }

      if (cancelled || !hostRef.current) return;

      try {
        legacyInput = document.createElement('input');
        legacyInput.type = 'text';
        legacyInput.className = 'camp-address-legacy-input';
        legacyInput.placeholder = placeholder;
        legacyInput.autocomplete = 'off';
        legacyInput.defaultValue = value || '';
        legacyInput.disabled = disabled;
        legacyInput.addEventListener('input', (e) => onChangeRef.current?.(e.target.value));
        hostRef.current.appendChild(legacyInput);

        legacyAutocomplete = new window.google.maps.places.Autocomplete(legacyInput, {
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
          types: ['geocode', 'establishment'],
        });

        legacyListener = legacyAutocomplete.addListener('place_changed', () => {
          const place = legacyAutocomplete.getPlace();
          emitPlaceSelection(place, onChangeRef.current, onPlaceSelectedRef.current);
          if (legacyInput && place?.formatted_address) {
            legacyInput.value = place.formatted_address;
          }
        });
        setMode('legacy');
      } catch {
        if (!cancelled) setMode('manual');
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once when API is ready
  }, [isReady, isDisabled, hasError, disabled, placeholder]);

  useEffect(() => {
    if (mode !== 'legacy' || !hostRef.current) return;
    const legacyInput = hostRef.current.querySelector('.camp-address-legacy-input');
    if (legacyInput && legacyInput.value !== value) {
      legacyInput.value = value;
    }
  }, [mode, value]);

  const showManual = mode === 'manual' || isDisabled || hasError;

  return (
    <div className="camp-address-autocomplete">
      {!showManual ? <div ref={hostRef} className="camp-address-autocomplete-host" /> : null}
      {showManual ? (
        <input
          ref={inputRef}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      ) : (
        <input type="hidden" value={value} required={required} readOnly tabIndex={-1} aria-hidden="true" />
      )}
      {isDisabled ? (
        <p className="muted camp-address-autocomplete-hint">
          Google Places is not configured — enter the address manually.
        </p>
      ) : null}
      {hasError ? (
        <p className="muted camp-address-autocomplete-hint">
          Address suggestions unavailable — you can still type the address manually.
        </p>
      ) : null}
      {mode === 'widget' ? (
        <p className="muted camp-address-autocomplete-hint">Search an address, then edit the fields below if needed.</p>
      ) : null}
    </div>
  );
}
