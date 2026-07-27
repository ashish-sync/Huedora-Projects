import { useEffect, useRef } from 'react';
import { useGoogleMapsPlaces } from '../../../shared/googleMaps/useGoogleMapsPlaces.js';
import { parseGooglePlace } from '../../../shared/googleMaps/parseGooglePlace.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';

/**
 * Camp address input with Google Places autocomplete (India).
 * Falls back to a plain text field when the API key is missing or fails to load.
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
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;
  const { isReady, isDisabled, hasError } = useGoogleMapsPlaces();

  useEffect(() => {
    if (!isReady || disabled || !inputRef.current || !window.google?.maps?.places) {
      return undefined;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const parsed = parseGooglePlace(place);
      if (!parsed) return;
      const zone = resolveZoneForState(parsed.state) || '';
      onPlaceSelectedRef.current?.({
        ...parsed,
        zone,
        city: parsed.city || parsed.district || '',
      });
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isReady, disabled]);

  return (
    <div className="camp-address-autocomplete">
      <input
        ref={inputRef}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
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
    </div>
  );
}
