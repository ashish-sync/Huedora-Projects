/** Canonical Product Master types (keep in sync with server IN_OUT_PRODUCT_TYPES). */
export const PRODUCT_TYPES = [
  'Medical Device',
  'Non-Medical Device',
  'Peripheral',
  'Consumable',
  'Spare Part',
  'Document',
  'Other',
];

/** Top-level classification for New Product (Medical vs Non-Medical). */
export const PRODUCT_CLASSIFICATIONS = ['Medical', 'Non-Medical'];

/**
 * Product Category under Classification.
 * Maps with classification → legacy productType for assets / logistics.
 */
export const PRODUCT_CATEGORY_KINDS = [
  'Device',
  'Peripheral',
  'Document',
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
  Document: 'DOC0001',
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
  Document: {
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
  Document: 'Document',
  Documents: 'Document',
  Other: 'Other',
  Device: 'Medical Device',
  'Peripheral Device': 'Peripheral',
  Accessory: 'Spare Part',
  Misc: 'Other',
  Miscellaneous: 'Other',
  'Spare Part / Accessory': 'Spare Part',
  Others: 'Other',
  'Devices Parts': 'Spare Part',
  'Device Part': 'Spare Part',
};

const CATEGORY_KIND_ALIASES = {
  Device: 'Device',
  Devices: 'Device',
  Peripheral: 'Peripheral',
  Prepheral: 'Peripheral',
  Document: 'Document',
  Documents: 'Document',
  Consumable: 'Consumable',
  Consumables: 'Consumable',
  'Spare Part': 'Spare Part',
  'Spare Parts': 'Spare Part',
  'Spart Part': 'Spare Part',
  Spare: 'Spare Part',
  Other: 'Other',
  Others: 'Other',
};

const CLASSIFICATION_ALIASES = {
  Medical: 'Medical',
  'Non-Medical': 'Non-Medical',
  'Non Medical': 'Non-Medical',
  NonMedical: 'Non-Medical',
  'Non medical': 'Non-Medical',
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

export function resolveProductClassification(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (PRODUCT_CLASSIFICATIONS.includes(v)) return v;
  if (CLASSIFICATION_ALIASES[v]) return CLASSIFICATION_ALIASES[v];
  const hit = Object.entries(CLASSIFICATION_ALIASES).find(
    ([k]) => k.toLowerCase() === v.toLowerCase()
  );
  return hit?.[1] || '';
}

export function resolveProductCategoryKind(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (PRODUCT_CATEGORY_KINDS.includes(v)) return v;
  if (CATEGORY_KIND_ALIASES[v]) return CATEGORY_KIND_ALIASES[v];
  const hit = Object.entries(CATEGORY_KIND_ALIASES).find(
    ([k]) => k.toLowerCase() === v.toLowerCase()
  );
  return hit?.[1] || '';
}

/** Classification + Category → stored productType (backward compatible). */
export function composeProductType(classification, categoryKind) {
  const kind = resolveProductCategoryKind(categoryKind) || 'Other';
  const cls = resolveProductClassification(classification) || 'Medical';
  if (kind === 'Device') {
    return cls === 'Non-Medical' ? 'Non-Medical Device' : 'Medical Device';
  }
  if (kind === 'Peripheral') return 'Peripheral';
  if (kind === 'Document') return 'Document';
  if (kind === 'Consumable') return 'Consumable';
  if (kind === 'Spare Part') return 'Spare Part';
  return 'Other';
}

/**
 * Split a stored productType (+ optional classification) into UI cascade values.
 * Classification is preferred when present for non-Device types.
 */
export function decomposeProductType(productType, productClassification = '') {
  const type = resolveProductType(productType);
  const storedCls = resolveProductClassification(productClassification);

  if (type === 'Medical Device') {
    return { classification: 'Medical', categoryKind: 'Device' };
  }
  if (type === 'Non-Medical Device') {
    return { classification: 'Non-Medical', categoryKind: 'Device' };
  }

  let categoryKind = 'Other';
  if (type === 'Peripheral') categoryKind = 'Peripheral';
  else if (type === 'Document') categoryKind = 'Document';
  else if (type === 'Consumable') categoryKind = 'Consumable';
  else if (type === 'Spare Part') categoryKind = 'Spare Part';
  else if (type === 'Other') categoryKind = 'Other';

  return {
    classification: storedCls || 'Medical',
    categoryKind,
  };
}
