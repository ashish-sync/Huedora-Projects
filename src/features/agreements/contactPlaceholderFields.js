/** Map Document One template placeholders to Contact Directory fields. */

import { isAssetRegistryPlaceholder } from './assetPlaceholderFields.js';

function normToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

export function placeholderContactField(placeholder) {
  if (isAssetRegistryPlaceholder(placeholder)) return null;

  const key = normToken(placeholder?.key);
  const label = normToken(placeholder?.label);
  const haystack = `${key} ${label}`.trim();

  if (
    haystack.includes('pin code') ||
    haystack.includes('pincode') ||
    haystack.includes('postal') ||
    haystack.split(' ').includes('pin') ||
    haystack.split(' ').includes('zip')
  ) {
    return 'pinCode';
  }
  if (haystack.includes('district')) return 'district';
  if (haystack.includes('city')) return 'city';
  if (haystack.includes('state') && !haystack.includes('state id')) return 'state';
  if (haystack.includes('address') || haystack.includes('street')) return 'address';
  if (
    haystack.includes('organization') ||
    haystack.includes('organisation') ||
    haystack.includes('company')
  ) {
    return 'organization';
  }
  if (haystack.includes('profession') || haystack.includes('designation')) {
    return 'profession';
  }
  if (haystack.includes('email')) return 'email';
  if (
    haystack.includes('mobile') ||
    haystack.includes('phone') ||
    haystack.includes('contact number') ||
    haystack === 'contact'
  ) {
    return 'phone';
  }
  if (
    haystack === 'name' ||
    haystack.includes('signer') ||
    haystack.includes('recipient') ||
    haystack.includes('party name') ||
    haystack.includes('contact name') ||
    (haystack.includes('name') && !haystack.includes('asset') && !haystack.includes('device'))
  ) {
    return 'name';
  }
  return null;
}

function contactValue(contact, field) {
  if (!contact || !field) return '';
  if (field === 'phone') {
    return String(contact.contact || contact.mobile || '').trim();
  }
  return String(contact[field] || '').trim();
}

/**
 * Apply Contact Directory values into placeholder form state.
 * Contact is applied before asset snapshots so asset fields still win on overlap.
 */
export function applyContactSnapshotToPlaceholders(placeholders, contact, prev = {}) {
  if (!contact) return prev;
  const next = { ...prev };
  for (const p of placeholders || []) {
    const field = placeholderContactField(p);
    if (!field) continue;
    const value = contactValue(contact, field);
    if (value) next[p.key] = value;
  }
  return next;
}
