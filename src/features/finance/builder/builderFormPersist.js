/** Media fields that belong on Commercial Org Master — not per-document builderForm. */
const MEDIA_KEYS = new Set(['logoDataUrl', 'paymentQrDataUrl', 'signatureDataUrl', 'imageDataUrl']);

function stripValue(value, depth = 0) {
  if (value == null || depth > 14) return value;
  if (typeof value === 'string') {
    return value.startsWith('data:image') || value.startsWith('data:application') ? '' : value;
  }
  if (Array.isArray(value)) return value.map((item) => stripValue(item, depth + 1));
  if (typeof value !== 'object') return value;
  const out = { ...value };
  for (const key of Object.keys(out)) {
    if (MEDIA_KEYS.has(key)) out[key] = '';
    else out[key] = stripValue(out[key], depth + 1);
  }
  return out;
}

/** Clone form for API persistence without embedding multi‑MB data-URLs. */
export function builderFormForPersist(form) {
  if (!form || typeof form !== 'object') return null;
  return stripValue(form);
}
