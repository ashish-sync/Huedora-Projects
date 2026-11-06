export const TRAVEL_STATUS = {
  NO_HCW: 'Assign an HCW before travel distance can be estimated — enter distance manually.',
  PIN_MISSING: 'HCW PIN code is missing in Contact Directory — enter distance manually.',
  COORDS_MISSING: 'Camp coordinates and PIN are missing — enter distance manually or pick the venue address.',
  UNAVAILABLE: 'Travel estimate unavailable — enter distance manually.',
  ESTIMATING: 'Estimating travel distance…',
};

export function estimatedTravelStatus(pin) {
  return `Estimated from HCW PIN ${pin} to camp venue (round trip).`;
}

export function extractIndiaPin(text) {
  const match = String(text || '').match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}

export function hasValidCampCoords(form = {}) {
  const latRaw = String(form.latitude ?? '').trim();
  const lngRaw = String(form.longitude ?? '').trim();
  if (!latRaw || !lngRaw) return false;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return !(lat === 0 && lng === 0);
}

export function travelEstimateKey({ pin, destLat, destLng, destPin } = {}) {
  const pinKey = extractIndiaPin(pin);
  if (!pinKey) return '';
  if (hasValidCampCoords({ latitude: destLat, longitude: destLng })) {
    const lat = Number(destLat);
    const lng = Number(destLng);
    return `${pinKey}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  }
  const dest = extractIndiaPin(destPin);
  return dest ? `${pinKey}|pin:${dest}` : '';
}

export function resolveHcwTravelPin(contact, contacts = []) {
  const direct = extractIndiaPin(contact?.pinCode || contact?.pincode || '');
  if (direct) return direct;
  const providerId = String(contact?.serviceProviderContactId || '').trim();
  if (!providerId) return '';
  const provider = contacts.find((row) => String(row._id) === providerId);
  return extractIndiaPin(provider?.pinCode || provider?.pincode || '');
}

export function resolveHcwOriginCoords(contact) {
  const lat = Number(contact?.latitude);
  const lng = Number(contact?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return { originLat: '', originLng: '' };
  }
  return { originLat: String(lat), originLng: String(lng) };
}

/** Auto-fill never writes 0. Manual 0 stays the user's value. */
export function usableEstimatedKm(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hasExistingTravelKm(value) {
  return usableEstimatedKm(value) != null;
}

export function shouldKeepManualTravel(source) {
  return String(source || '') === 'manual';
}

/**
 * Legacy camps stored Travelled Kms before kmRoundTripSource existed (empty source).
 * Preserve that distance until the user explicitly edits it (manual) or an auto
 * estimate already owns the field. Never silently overwrite existing km when the
 * estimate key changes (PIN / venue / destPin format).
 */
export function shouldPreserveTravelKm(source, km) {
  if (shouldKeepManualTravel(source)) return true;
  const normalized = String(source || '').trim();
  if (!normalized && hasExistingTravelKm(km)) return true;
  return false;
}

/**
 * Prefer the full Contact Directory document (assignedHcwContact) over the
 * assign=1 list row, which omits latitude/longitude and may omit address fields.
 */
export function resolveTravelContact({ assignedHcwContact = null, listContact = null, hcwContactId = '' } = {}) {
  const id = String(hcwContactId || '').trim();
  if (
    assignedHcwContact
    && String(assignedHcwContact._id || '') === id
  ) {
    return assignedHcwContact;
  }
  return listContact || null;
}

const travelEstimateClientCache = new Map();

export function readTravelEstimateCache(key) {
  return key ? travelEstimateClientCache.get(key) || null : null;
}

export function writeTravelEstimateCache(key, value) {
  if (key && usableEstimatedKm(value?.kmRoundTrip)) {
    travelEstimateClientCache.set(key, value);
  }
}
