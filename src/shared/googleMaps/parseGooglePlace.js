function componentValue(components, type, field = 'long_name') {
  const hit = components.find((c) => c.types?.includes(type));
  return hit ? hit[field] : '';
}

/**
 * Map a Google Places result to camp location fields (India-focused).
 */
export function parseGooglePlace(place) {
  if (!place) return null;
  const components = place.address_components || [];
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
  const lat = place.geometry?.location?.lat?.();
  const lng = place.geometry?.location?.lng?.();

  return {
    campAddress: place.formatted_address || place.name || '',
    city,
    district,
    state,
    pincode,
    latitude: Number.isFinite(lat) ? String(lat) : '',
    longitude: Number.isFinite(lng) ? String(lng) : '',
  };
}
