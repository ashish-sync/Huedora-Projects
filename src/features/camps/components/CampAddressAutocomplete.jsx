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

async function resolvePlaceFromSelectEvent(event) {
  if (event?.place) return event.place;
  if (event?.placePrediction?.toPlace) {
    return event.placePrediction.toPlace();
  }
  return null;
}

async function loadPlaceDetails(place) {
  if (!place) return null;
  if (typeof place.fetchFields === 'function') {
    await place.fetchFields({
      fields: ['addressComponents', 'formattedAddress', 'location', 'displayName'],
    });
  }
  return place;
}

/**
 * Camp address search with Google Places (legacy Autocomplete + new widget fallback).
 */
export default function CampAddressAutocomplete({
  value = '',
  onChange,
  onPlaceSelected,
  disabled = false,
  required = false,
  placeholder = 'Start typing address…',
}) {
  const inputRef = useRef(null);
  const widgetHostRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onChangeRef.current = onChange;
  onPlaceSelectedRef.current = onPlaceSelected;

  const { isReady, isDisabled, isResolving, hasError } = useGoogleMapsPlaces();
  const [mode, setMode] = useState('idle'); // idle | legacy | widget | manual

  useEffect(() => {
    if (isDisabled || hasError) {
      setMode('manual');
      return undefined;
    }
    if (!isReady || disabled) {
      return undefined;
    }

    let cancelled = false;
    let legacyAutocomplete = null;
    let legacyListener = null;
    let widget = null;
    let widgetSelectHandler = null;
    let widgetLegacySelectHandler = null;

    const cleanup = () => {
      if (legacyListener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(legacyListener);
      }
      legacyListener = null;
      legacyAutocomplete = null;

      if (widget) {
        if (widgetSelectHandler) {
          widget.removeEventListener('gmp-select', widgetSelectHandler);
        }
        if (widgetLegacySelectHandler) {
          widget.removeEventListener('gmp-placeselect', widgetLegacySelectHandler);
        }
        if (widget.parentNode) widget.parentNode.removeChild(widget);
      }
      widget = null;
      if (widgetHostRef.current) widgetHostRef.current.innerHTML = '';
    };

    const attachLegacy = () => {
      if (cancelled || !inputRef.current) return false;
      try {
        legacyAutocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
        });
        legacyListener = legacyAutocomplete.addListener('place_changed', () => {
          const place = legacyAutocomplete.getPlace();
          emitPlaceSelection(place, onChangeRef.current, onPlaceSelectedRef.current);
        });
        if (!cancelled) setMode('legacy');
        return true;
      } catch {
        return false;
      }
    };

    const attachWidget = async () => {
      if (cancelled || !widgetHostRef.current) return false;
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
        if (cancelled || !widgetHostRef.current) return false;

        widget = new PlaceAutocompleteElement({
          includedRegionCodes: ['in'],
          requestedLanguage: 'en',
        });
        widget.classList.add('camp-place-autocomplete-widget');
        widget.placeholder = placeholder;
        widgetHostRef.current.appendChild(widget);

        const onSelect = async (event) => {
          try {
            const place = await loadPlaceDetails(await resolvePlaceFromSelectEvent(event));
            emitPlaceSelection(place, onChangeRef.current, onPlaceSelectedRef.current);
          } catch {
            /* keep manual fields editable */
          }
        };

        widgetSelectHandler = onSelect;
        widgetLegacySelectHandler = onSelect;
        widget.addEventListener('gmp-select', widgetSelectHandler);
        widget.addEventListener('gmp-placeselect', widgetLegacySelectHandler);

        if (!cancelled) setMode('widget');
        return true;
      } catch {
        return false;
      }
    };

    (async () => {
      if (attachLegacy()) return;
      if (await attachWidget()) return;
      if (!cancelled) setMode('manual');
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isReady, isDisabled, hasError, disabled, placeholder]);

  const showWidget = mode === 'widget';

  return (
    <div className="camp-address-autocomplete">
      <div
        ref={widgetHostRef}
        className="camp-address-autocomplete-host"
        style={{ display: showWidget ? 'block' : 'none' }}
        aria-hidden={!showWidget}
      />
      <input
        ref={inputRef}
        className="camp-address-legacy-input"
        style={{ display: showWidget ? 'none' : 'block' }}
        required={!showWidget && required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-hidden={showWidget}
      />
      {showWidget ? (
        <input type="hidden" value={value} required={required} readOnly tabIndex={-1} aria-hidden="true" />
      ) : null}
      {isResolving ? (
        <p className="muted camp-address-autocomplete-hint">Loading address search…</p>
      ) : null}
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
      {mode === 'legacy' || mode === 'widget' ? (
        <p className="muted camp-address-autocomplete-hint">Search an address, then edit the fields below if needed.</p>
      ) : null}
    </div>
  );
}
