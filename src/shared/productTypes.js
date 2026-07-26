/** Canonical Product Master types (keep in sync with server IN_OUT_PRODUCT_TYPES). */
export const PRODUCT_TYPES = [
  'Medical Device',
  'Non-Medical Device',
  'Peripheral',
  'Consumable',
  'Spare Part',
  'Other',
];

export const PRODUCT_TYPE_CODE_HINTS = {
  'Medical Device': 'MD0001',
  'Non-Medical Device': 'NMD0001',
  Peripheral: 'PER0001',
  Consumable: 'CON0001',
  'Spare Part': 'SP0001',
  Other: 'OTH0001',
};

/** Defaults applied when a product type is selected in Product Master. */
export const PRODUCT_TYPE_FORM_DEFAULTS = {
  'Medical Device': {
    expiryApplicable: false,
    inventoryType: 'Asset',
  },
  'Non-Medical Device': {
    expiryApplicable: false,
    inventoryType: 'Asset',
  },
  Peripheral: {
    expiryApplicable: false,
    inventoryType: 'Inventory',
  },
  Consumable: {
    expiryApplicable: true,
    inventoryType: 'Inventory',
  },
  'Spare Part': {
    expiryApplicable: false,
    inventoryType: 'Inventory',
  },
  Other: {
    expiryApplicable: false,
    inventoryType: 'Inventory',
  },
};

const PRODUCT_TYPE_LEGACY_ALIASES = {
  'Medical Device': 'Medical Device',
  'Non-Medical Device': 'Non-Medical Device',
  Peripheral: 'Peripheral',
  Consumable: 'Consumable',
  Consumables: 'Consumable',
  'Spare Part': 'Spare Part',
  Other: 'Other',
  Device: 'Medical Device',
  'Peripheral Device': 'Peripheral',
  Accessory: 'Spare Part',
  Document: 'Other',
  Misc: 'Other',
  Miscellaneous: 'Other',
  'Spare Part / Accessory': 'Spare Part',
  Documents: 'Other',
  Others: 'Other',
  'Devices Parts': 'Spare Part',
  'Device Part': 'Spare Part',
};

/** Normalize legacy product types to the current Product Master set. */
export function resolveProductType(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (PRODUCT_TYPES.includes(v)) return v;
  if (PRODUCT_TYPE_LEGACY_ALIASES[v]) return PRODUCT_TYPE_LEGACY_ALIASES[v];
  const hit = Object.entries(PRODUCT_TYPE_LEGACY_ALIASES).find(
    ([k]) => k.toLowerCase() === v.toLowerCase()
  );
  return hit?.[1] || v;
}
