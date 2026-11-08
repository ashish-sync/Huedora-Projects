/**
 * Finance One Click-to-Sign — text digital signature block.
 * Visual: UPPERCASE NAME + "Digitally signed on DD-MM-YYYY HH:MM:SS"
 */

import { formatDate, parseToDate, TIME_ZONE } from '../../../shared/dateFormat.js';

export const CLICK_TO_SIGN_MODE = 'click_to_sign';

const TIME_WITH_SECONDS_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function formatTimeWithSeconds(value) {
  const date = parseToDate(value);
  if (!date) return '';
  const parts = TIME_WITH_SECONDS_FMT.formatToParts(date);
  let h = '';
  let m = '';
  let s = '';
  for (const p of parts) {
    if (p.type === 'hour') h = p.value;
    else if (p.type === 'minute') m = p.value;
    else if (p.type === 'second') s = p.value;
  }
  return `${h}:${m}:${s}`;
}

export function formatDateTimeWithSeconds(value) {
  const date = parseToDate(value);
  if (!date) return '';
  return `${formatDate(date)} ${formatTimeWithSeconds(date)}`;
}

/** Line shown under the name — matches reference stamp. */
export function formatDigitallySignedOn(signedAt) {
  const stamp = formatDateTimeWithSeconds(signedAt || new Date());
  if (!stamp) return '';
  return `Digitally signed on ${stamp}`;
}

export function normalizeSignatoryDisplayName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function isClickToSignSignature(signature) {
  if (!signature || typeof signature !== 'object') return false;
  return (
    signature.mode === CLICK_TO_SIGN_MODE
    && Boolean(String(signature.signedAt || '').trim())
    && Boolean(normalizeSignatoryDisplayName(signature.signatoryName))
  );
}

/**
 * Resolve stamp name from Organisation Master signatory (never the logged-in user).
 * Prefer the form signature field (already seeded from org master), then explicit org master.
 */
export function resolveClickToSignName({ signature, orgMaster, fallback = '' } = {}) {
  const fromForm = signature?.signatoryName || '';
  const fromOrg = orgMaster?.signatoryName || '';
  return normalizeSignatoryDisplayName(fromForm || fromOrg || fallback);
}

/**
 * Apply click-to-sign onto an existing signature object (partial merge).
 * Clears image so the text stamp matches the reference (name + timestamp only).
 */
export function applyClickToSign(existing = {}, { fullName, signedAt } = {}) {
  const name = normalizeSignatoryDisplayName(fullName || existing.signatoryName);
  const at = signedAt || new Date().toISOString();
  return {
    ...existing,
    mode: CLICK_TO_SIGN_MODE,
    signatoryName: name,
    signedAt: at,
    imageDataUrl: '',
  };
}

/**
 * Clear click-to-sign stamp and signature image so the Digital Signature box
 * can render blank (header only). Keeps signatoryName for re-sign from Org Master.
 * Pass restoreImageDataUrl to put an image back after clear.
 */
export function clearClickToSign(existing = {}, { restoreImageDataUrl } = {}) {
  return {
    ...existing,
    mode: '',
    signedAt: '',
    imageDataUrl: restoreImageDataUrl !== undefined ? restoreImageDataUrl : '',
  };
}
