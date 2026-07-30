import { cleanSpaces, formatFormFields, formatTextValue } from '../../../shared/textFormat.js';

export function trimString(value) {
  return typeof value === 'string' ? cleanSpaces(value) : value;
}

export function trimParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'string' ? formatTextValue(value, key) : value,
    ])
  );
}

/** @deprecated Use formatFormStrings */
export function trimFormStrings(form, keys) {
  return formatFormStrings(form, keys);
}

export function formatFormStrings(form, keys) {
  return formatFormFields(form, keys);
}
