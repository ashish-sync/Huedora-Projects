/**
 * Detect Document One date merge fields (e.g. Todays Date, Effective Date).
 * Works for stored type === 'date' and legacy text placeholders whose labels contain Date.
 */

export function isDatePlaceholder(placeholder = {}) {
  if (String(placeholder?.type || '').toLowerCase() === 'date') return true;
  const hay = [
    placeholder?.key,
    placeholder?.label,
    placeholder?.inner,
    placeholder?.token,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/['’]/g, '');
  if (!hay) return false;
  if (/\btodays?\s*date\b/.test(hay)) return true;
  if (/\beffective\s*date\b/.test(hay)) return true;
  if (/\b(start|end|issue|expiry|expiration|camp|agreement|po|wo)\s*date\b/.test(hay)) {
    return true;
  }
  // Whole-word "date" / "dated" — avoids matching "update"
  return /\bdates?\b/.test(hay) || /\bdated\b/.test(hay);
}

export function isTodayDatePlaceholder(placeholder = {}) {
  const hay = [
    placeholder?.key,
    placeholder?.label,
    placeholder?.inner,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/['’]/g, '');
  return /\btodays?\s*date\b/.test(hay);
}
