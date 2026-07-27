import { apiUrl } from '../config.js';

let cachedKey = null;
let fetchPromise = null;

/**
 * Resolve the Google Maps API key from the Vite build env or the public API config.
 */
export async function resolveGoogleMapsApiKey() {
  const fromBuild = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (fromBuild) return fromBuild;
  if (cachedKey) return cachedKey;

  if (!fetchPromise) {
    fetchPromise = fetch(apiUrl('/config/public'))
      .then(async (res) => {
        if (!res.ok) return '';
        const body = await res.json();
        return String(body?.data?.googleMapsApiKey || '').trim();
      })
      .catch(() => '')
      .finally(() => {
        fetchPromise = null;
      });
  }

  cachedKey = await fetchPromise;
  return cachedKey;
}
