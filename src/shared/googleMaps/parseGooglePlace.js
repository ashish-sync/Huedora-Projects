function componentValue(components, type, field = 'long_name') {
  if (!Array.isArray(components)) return '';
  const hit = components.find((c) => c.types?.includes(type));
  if (!hit) return '';
  if (field === 'short_name') {
    return hit.short_name || hit.shortText || '';
  }
  return hit.long_name || hit.longText || '';
}

function readLatLng(location) {
  if (!location) return { lat: '', lng: '' };
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  return {
    lat: Number.isFinite(lat) ? String(lat) : '',
    lng: Number.isFinite(lng) ? String(lng) : '',
  };
}

/**
 * Map a Google Places result (legacy or new Places API) to camp location fields.
 */
export function parseGooglePlace(place) {
  if (!place) return null;

  const components = place.address_components || place.addressComponents || [];
  const city =
    componentValue(components, 'locality')
    || componentValue(components, 'postal_town')
    || componentValue(components, 'sublocality_level_1')
    || componentValue(components, 'administrative_area_level_2')
    || '';
  const district =
    componentValue(components, 'administrative_area_level_3')
    || componentValue(components, 'administrative_area_level_2')
    || '';
  const state = componentValue(components, 'administrative_area_level_1');
  const pincode = componentValue(components, 'postal_code', 'short_name');

  const { lat, lng } = readLatLng(place.geometry?.location || place.location);

  const campAddress =
    place.formatted_address
    || place.formattedAddress
    || place.displayName
    || place.name
    || '';

  if (!campAddress && !state && !pincode) return null;

  return {
    campAddress,
    city,
    district,
    state,
    pincode,
    latitude: lat,
    longitude: lng,
  };
}
