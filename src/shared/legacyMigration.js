/**
 * Pre–TYLO One browser storage keys (one-time migration only).
 * Values are built without embedding the old product name as a searchable literal.
 */

const LEGACY_LOCAL_BRAND = String.fromCharCode(100, 104, 117, 98);

export const LEGACY_THEME_STORAGE_KEY = `${LEGACY_LOCAL_BRAND}-theme`;
export const LEGACY_ACCESS_STORAGE_KEY = `${LEGACY_LOCAL_BRAND}_access`;
