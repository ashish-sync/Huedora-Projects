/** Product types that use Asset One register (agreements + custody). */
export const ASSET_REGISTER_PRODUCT_TYPES = ['Medical Device', 'Non-Medical Device'];

/** All Product Master types (inward via Movement One for every type). */
export const ALL_PRODUCT_TYPES = [
  'Medical Device',
  'Non-Medical Device',
  'Peripheral Device',
  'Accessory',
  'Spare Part',
  'Consumable',
  'Document',
  'Other',
];

/** @deprecated Use ASSET_REGISTER_PRODUCT_TYPES or ALL_PRODUCT_TYPES */
export const ASSET_PRODUCT_TYPES = ALL_PRODUCT_TYPES;

export function productTypeToSlug(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugToProductType(slug, allowed = ALL_PRODUCT_TYPES) {
  const want = String(slug || '')
    .trim()
    .toLowerCase();
  return allowed.find((t) => productTypeToSlug(t) === want) || '';
}

export function slugToRegisterProductType(slug) {
  return slugToProductType(slug, ASSET_REGISTER_PRODUCT_TYPES);
}

export function isRegisterProductType(type) {
  return ASSET_REGISTER_PRODUCT_TYPES.includes(String(type || '').trim());
}
