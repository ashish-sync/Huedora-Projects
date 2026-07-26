import { PRODUCT_TYPES, resolveProductType } from './productTypes.js';

export { PRODUCT_TYPES, resolveProductType };

/** Auto-generated product code prefixes by type. */
export const PRODUCT_TYPE_CODE_PREFIX = {
  'Medical Device': 'MD',
  'Non-Medical Device': 'NMD',
  Peripheral: 'PER',
  Consumable: 'CON',
  'Spare Part': 'SP',
  Other: 'OTH',
};

export const PRODUCT_TYPE_CODE_HINTS = Object.fromEntries(
  Object.entries(PRODUCT_TYPE_CODE_PREFIX).map(([type, prefix]) => [type, `${prefix}0001`])
);

export const INVENTORY_CLASS_TYPES = ['Asset', 'Inventory'];

export const GST_RATE_PRESETS = [0, 5, 12, 18, 28];

/** Medical Device categories align with camp / hiring methods. */
export const MEDICAL_DEVICE_PRODUCT_CATEGORIES = [
  'BMD',
  'Diagnostics',
  'Uroflow',
  'Dietician',
  'Neuro & Physio',
  'Others',
];

const MEDICAL_DEVICE_CATEGORY_ALIASES = {
  BMD: 'BMD',
  Diagnostics: 'Diagnostics',
  Diagnostic: 'Diagnostics',
  Daignostics: 'Diagnostics',
  Uroflow: 'Uroflow',
  Dietician: 'Dietician',
  Dietitian: 'Dietician',
  'Neuro & Physio': 'Neuro & Physio',
  'Physio & Neuro': 'Neuro & Physio',
  'Physio & Nuero': 'Neuro & Physio',
  Others: 'Others',
  Other: 'Others',
  Therapeutic: 'Others',
  Monitoring: 'Others',
  Imaging: 'Others',
  Laboratory: 'Others',
  Surgical: 'Others',
  'Life Support': 'Others',
};

/** Product categories available per product type. */
export const PRODUCT_CATEGORIES_BY_TYPE = {
  'Medical Device': [...MEDICAL_DEVICE_PRODUCT_CATEGORIES],
  'Non-Medical Device': [
    'IT Equipment',
    'Office Equipment',
    'Facility Equipment',
    'Safety Equipment',
    'Furniture',
    'Other',
  ],
  Peripheral: [
    'Computer Peripheral',
    'Network Peripheral',
    'Medical Peripheral',
    'Printing Peripheral',
    'Other',
  ],
  Consumable: [
    'Medical Consumable',
    'Laboratory Consumable',
    'Office Consumable',
    'Chemical / Reagent',
    'PPE',
    'Other',
  ],
  'Spare Part': [
    'Mechanical Part',
    'Electronic Part',
    'Wear Part',
    'Consumable Kit',
    'Other',
  ],
  Other: ['General', 'Packaging', 'Marketing', 'Other'],
};

/** Defaults when product type changes in the form. */
export const PRODUCT_TYPE_DEFAULTS = {
  'Medical Device': {
    productCategory: 'BMD',
    inventoryType: 'Asset',
    expiryApplicable: false,
    warrantyMonths: '12',
  },
  'Non-Medical Device': {
    productCategory: 'IT Equipment',
    inventoryType: 'Asset',
    expiryApplicable: false,
    warrantyMonths: '12',
  },
  Peripheral: {
    productCategory: 'Computer Peripheral',
    inventoryType: 'Inventory',
    expiryApplicable: false,
    warrantyMonths: '6',
  },
  Consumable: {
    productCategory: 'Medical Consumable',
    inventoryType: 'Inventory',
    expiryApplicable: true,
    warrantyMonths: '',
  },
  'Spare Part': {
    productCategory: 'Mechanical Part',
    inventoryType: 'Inventory',
    expiryApplicable: false,
    warrantyMonths: '3',
  },
  Other: {
    productCategory: 'General',
    inventoryType: 'Inventory',
    expiryApplicable: false,
    warrantyMonths: '',
  },
};

/** Allowed inventory class per product type (drives Asset Register vs stock). */
export const INVENTORY_TYPES_BY_PRODUCT_TYPE = {
  'Medical Device': ['Asset'],
  'Non-Medical Device': ['Asset'],
  Peripheral: ['Inventory'],
  Consumable: ['Inventory'],
  'Spare Part': ['Inventory'],
  Other: ['Inventory'],
};

export function inventoryTypesForProduct(productType) {
  return INVENTORY_TYPES_BY_PRODUCT_TYPE[resolveProductType(productType)] || ['Inventory'];
}

export function isInventoryTypeLocked(productType) {
  return inventoryTypesForProduct(productType).length === 1;
}

export function resolveInventoryTypeForProduct(productType, raw) {
  const allowed = inventoryTypesForProduct(productType);
  const resolved = resolveInventoryClass(raw);
  if (resolved && allowed.includes(resolved)) return resolved;
  return allowed[0];
}

/** Apply type-driven defaults and constraints when type or related fields change. */
export function applyProductTypeRules(productType, current = {}) {
  const type = resolveProductType(productType) || 'Other';
  const defaults = PRODUCT_TYPE_DEFAULTS[type] || PRODUCT_TYPE_DEFAULTS.Other;
  const inventoryType = resolveInventoryTypeForProduct(type, current.inventoryType);
  const consumable = isConsumableType(type);
  const device = isDeviceType(type);

  let expiryApplicable = current.expiryApplicable;
  if (consumable) expiryApplicable = true;
  else if (device) expiryApplicable = false;
  else if (expiryApplicable == null) expiryApplicable = defaults.expiryApplicable;

  return {
    productCategory: resolveProductCategory(
      type,
      current.productCategory || defaults.productCategory
    ),
    inventoryType,
    expiryApplicable: !!expiryApplicable,
    warrantyMonths: device ? current.warrantyMonths ?? defaults.warrantyMonths : '',
    reorderLevel: device ? '' : current.reorderLevel ?? '',
    unitsPerPack: consumable ? current.unitsPerPack ?? '1' : '1',
    associatedProductIds: device || type === 'Peripheral' ? current.associatedProductIds || [] : [],
  };
}

export function isExpiryLocked(productType) {
  const t = resolveProductType(productType);
  return t === 'Consumable' || isDeviceType(t);
}

export function categoriesForType(productType) {
  return PRODUCT_CATEGORIES_BY_TYPE[resolveProductType(productType)] || PRODUCT_CATEGORIES_BY_TYPE.Other;
}

export function resolveMedicalDeviceCategory(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (MEDICAL_DEVICE_PRODUCT_CATEGORIES.includes(v)) return v;
  if (MEDICAL_DEVICE_CATEGORY_ALIASES[v]) return MEDICAL_DEVICE_CATEGORY_ALIASES[v];
  const hit = Object.entries(MEDICAL_DEVICE_CATEGORY_ALIASES).find(
    ([k]) => k.toLowerCase() === v.toLowerCase()
  );
  return hit?.[1] || '';
}

export function resolveProductCategory(productType, raw) {
  const type = resolveProductType(productType);
  const allowed = categoriesForType(type);
  const v = String(raw || '').trim();
  if (!v) return allowed[0] || '';
  if (allowed.includes(v)) return v;
  if (type === 'Medical Device') {
    const mapped = resolveMedicalDeviceCategory(v);
    if (mapped) return mapped;
  }
  return allowed.includes('Others') ? 'Others' : allowed.includes('Other') ? 'Other' : allowed[0] || v;
}

export function isConsumableType(productType) {
  return resolveProductType(productType) === 'Consumable';
}

export function isDeviceType(productType) {
  const t = resolveProductType(productType);
  return t === 'Medical Device' || t === 'Non-Medical Device';
}

export function showWarrantyField(productType) {
  return isDeviceType(productType);
}

export function showReorderLevelField(productType) {
  return !isDeviceType(productType);
}

export function associatedProductTypesFor(productType) {
  const t = resolveProductType(productType);
  if (t === 'Medical Device' || t === 'Non-Medical Device') {
    return ['Peripheral', 'Consumable', 'Spare Part', 'Other'];
  }
  if (t === 'Peripheral') return ['Consumable', 'Spare Part', 'Other'];
  if (t === 'Spare Part') return ['Consumable', 'Other'];
  return [];
}

export function suggestProductName(brand, model) {
  const b = String(brand || '').trim();
  const m = String(model || '').trim();
  if (b && m) return `${b} — ${m}`;
  return m || b || '';
}

export function validateProductForm(form) {
  if (!String(form.productType || '').trim()) return 'Product Type is required';
  if (!String(form.brand || '').trim()) return 'Brand / Manufacturer is required';
  if (!String(form.model || '').trim()) return 'Model / Variant is required';
  if (!String(form.name || '').trim()) return 'Product Name is required';
  if (!String(form.productCategory || '').trim()) return 'Product Category is required';
  const allowedCategories = categoriesForType(form.productType);
  if (!allowedCategories.includes(form.productCategory)) {
    return `Product Category must be one of: ${allowedCategories.join(', ')}`;
  }
  if (!String(form.inventoryType || '').trim()) return 'Inventory Type is required';
  const allowedInventory = inventoryTypesForProduct(form.productType);
  if (!allowedInventory.includes(form.inventoryType)) {
    return `${resolveProductType(form.productType)} must use Inventory Type: ${allowedInventory.join(', ')}`;
  }
  if (isDeviceType(form.productType) && form.inventoryType === 'Inventory') {
    return 'Medical Device and Non-Medical Device must be Inventory Type: Asset';
  }
  if (isConsumableType(form.productType) && !form.expiryApplicable) {
    return 'Consumables must have Expiry Applicable set to Yes';
  }
  if (isDeviceType(form.productType) && form.expiryApplicable) {
    return 'Medical Device and Non-Medical Device cannot have expiry tracking';
  }
  if (isConsumableType(form.productType)) {
    const upp = Number(form.unitsPerPack);
    if (!Number.isFinite(upp) || upp < 1) return 'Units per Pack must be at least 1 for consumables';
  }
  const gst = Number(form.gstRate);
  if (!Number.isFinite(gst) || gst < 0 || gst > 100) return 'GST must be between 0 and 100';
  const cost = form.purchaseCost === '' ? 0 : Number(form.purchaseCost);
  if (!Number.isFinite(cost) || cost < 0) return 'Default Purchase Cost must be zero or greater';
  return '';
}

export function emptyProductForm() {
  const defaults = PRODUCT_TYPE_DEFAULTS['Medical Device'];
  return {
    productType: 'Medical Device',
    productCategory: defaults.productCategory,
    brand: '',
    model: '',
    name: '',
    description: '',
    uomId: '',
    unitsPerPack: '1',
    purchaseCost: '',
    gstRate: '18',
    gstCustom: false,
    inventoryType: defaults.inventoryType,
    expiryApplicable: defaults.expiryApplicable,
    warrantyMonths: defaults.warrantyMonths,
    reorderLevel: '',
    associatedProductIds: [],
    isActive: true,
    remarks: '',
  };
}

export function rowToForm(row) {
  const gst = Number(row.gstRate ?? 0);
  const gstCustom = !GST_RATE_PRESETS.includes(gst);
  const productType = resolveProductType(row.productType) || 'Other';
  const defaults = PRODUCT_TYPE_DEFAULTS[productType] || PRODUCT_TYPE_DEFAULTS.Other;
  return {
    productType,
    productCategory: resolveProductCategory(productType, row.productCategory || defaults.productCategory),
    brand: row.brand || row.manufacturer || '',
    model: row.model || row.partNumber || '',
    name: row.name || suggestProductName(row.brand, row.model || row.partNumber),
    description: row.description || '',
    uomId: row.uomId || '',
    unitsPerPack: String(row.unitsPerPack ?? 1),
    purchaseCost: row.standardCost ?? row.defaultPerUnitCost ?? '',
    gstRate: String(gst),
    gstCustom,
    inventoryType: resolveInventoryTypeForProduct(productType, row.inventoryType),
    expiryApplicable: !!row.expiryApplicable,
    warrantyMonths: isDeviceType(productType)
      ? row.warrantyPeriodMonths != null && row.warrantyPeriodMonths !== ''
        ? String(row.warrantyPeriodMonths)
        : defaults.warrantyMonths
      : '',
    reorderLevel: isDeviceType(productType) ? '' : row.reorderLevel ?? row.minStock ?? '',
    associatedProductIds: Array.isArray(row.associatedProductIds)
      ? [...row.associatedProductIds]
      : Array.isArray(row.compatibleDeviceIds)
        ? []
        : [],
    isActive: row.isActive !== false,
    remarks: row.internalRemarks || '',
  };
}

export function formToPayload(form) {
  const productType = resolveProductType(form.productType) || 'Other';
  const model = String(form.model || '').trim();
  const brand = String(form.brand || '').trim();
  const name = String(form.name || '').trim() || suggestProductName(brand, model);
  return {
    productType,
    productCategory: String(form.productCategory || '').trim(),
    brand,
    manufacturer: brand,
    model,
    partNumber: model,
    name,
    description: String(form.description || '').trim(),
    uomId: form.uomId || null,
    unitsPerPack: isConsumableType(productType)
      ? Math.max(1, Number(form.unitsPerPack) || 1)
      : 1,
    purchaseCost: form.purchaseCost === '' ? 0 : Number(form.purchaseCost),
    standardCost: form.purchaseCost === '' ? 0 : Number(form.purchaseCost),
    gstRate: form.gstRate === '' ? 0 : Number(form.gstRate),
    inventoryType: resolveInventoryTypeForProduct(productType, form.inventoryType),
    expiryApplicable: !!form.expiryApplicable,
    warrantyPeriodMonths: isDeviceType(productType)
      ? form.warrantyMonths === ''
        ? 0
        : Math.max(0, Number(form.warrantyMonths) || 0)
      : 0,
    calibrationRequired: false,
    calibrationFrequency: '',
    reorderLevel: isDeviceType(productType)
      ? 0
      : form.reorderLevel === ''
        ? 0
        : Math.max(0, Number(form.reorderLevel) || 0),
    minStock: isDeviceType(productType)
      ? 0
      : form.reorderLevel === ''
        ? 0
        : Math.max(0, Number(form.reorderLevel) || 0),
    associatedProductIds: Array.isArray(form.associatedProductIds)
      ? form.associatedProductIds.filter(Boolean)
      : [],
    isActive: form.isActive !== false,
    internalRemarks: String(form.remarks || '').trim(),
  };
}

const INVENTORY_CLASS_ALIASES = {
  Asset: 'Asset',
  Inventory: 'Inventory',
  'Multi-use': 'Asset',
  'Replacement Part for Asset': 'Inventory',
  'Accessory of Asset': 'Inventory',
  'Consumed by Device': 'Inventory',
};

export function resolveInventoryClass(raw) {
  const v = String(raw || '').trim();
  if (INVENTORY_CLASS_TYPES.includes(v)) return v;
  return INVENTORY_CLASS_ALIASES[v] || '';
}

export function productListLabel(row) {
  const code = row.code ? `${row.code} · ` : '';
  const name = row.name || suggestProductName(row.brand, row.model);
  return `${code}${name}`;
}
