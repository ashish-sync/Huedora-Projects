/** Shared client-side field validators (mirror server identityNormalize rules). */

import { cleanSpaces } from './textFormat.js';

export function normalizeEmail(value) {
  return cleanSpaces(value).toLowerCase();
}

export function normalizePhone(value) {
  const raw = cleanSpaces(value);
  if (!raw) return '';
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(-10);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** Email must include @ and a domain with a real suffix (e.g. .com, .in, .net). */
export function isValidEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
}

/** Mobile must normalize to exactly 10 digits. */
export function isValidPhone(value) {
  return normalizePhone(value).length === 10;
}

export function isValidPhoneOrEmail(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw.includes('@')) return isValidEmail(raw);
  return isValidPhone(raw);
}

export function emailError(value, label = 'Email') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!isValidEmail(raw)) {
    return `${label} must include @ and a valid domain suffix (e.g. .com, .in, .net)`;
  }
  return '';
}

export function phoneError(value, label = 'Mobile number') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!isValidPhone(raw)) return `${label} must be exactly 10 digits`;
  return '';
}

export function phoneOrEmailError(value, label = 'Contact') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!isValidPhoneOrEmail(raw)) {
    return `${label} must be a 10-digit mobile number or an email with @ and a valid domain suffix`;
  }
  return '';
}

/** Split comma/semicolon/newline-separated email lists. */
export function parseEmailList(value) {
  return String(value || '')
    .split(/[;,\n]/)
    .map((email) => cleanSpaces(email).toLowerCase())
    .filter(Boolean);
}

export function emailListError(value, label = 'Email') {
  const emails = parseEmailList(value);
  if (!emails.length) return '';
  const invalid = emails.find((email) => !isValidEmail(email));
  if (invalid) {
    return `${label} “${invalid}” is invalid. Use a full address with @ and domain (e.g. .com, .in).`;
  }
  return '';
}

export const PAGE_SIZES = [10, 25, 50, 100];
