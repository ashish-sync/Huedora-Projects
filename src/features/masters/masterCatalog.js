/** Shared catalog for Master One hub + Request One “Master One Request”. */

export const MASTER_MODULES = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'movement', label: 'Movement One' },
  { id: 'document', label: 'Document One' },
];

export const PRODUCT_TYPES = [
  'Medical Device',
  'Non-Medical Device',
  'Peripheral Device',
  'Accessory',
  'Spare Part',
  'Consumable',
  'Document',
  'Other',
];
export const PRODUCT_INVENTORY_TYPES = [
  'Replacement Part for Asset',
  'Accessory of Asset',
  'Consumed by Device',
  'Multi-use',
];
export const GST_RATE_PRESETS = ['0', '5', '12', '18', '28'];
export const TRACKING_KINDS = ['None', 'Serial', 'Batch', 'Batch + Serial'];
export const DOCUMENT_TYPES = ['LEASE', 'TEMPORARY_OWNERSHIP', 'LETTER', 'OTHER'];
export const SIGNING_TYPES = ['SIGNING', 'NON_SIGNING'];
export const SIGNATURE_ROLES = [
  'HR',
  'Director Finance',
  'CFO',
  'CEO',
  'Legal',
  'Asset Manager',
  'Procurement',
  'Operations',
  'Verifier',
  'Other',
];

/**
 * @typedef {{ name: string, label: string, required?: boolean, type?: string, options?: string[], source?: string, hideOnRequest?: boolean }} MasterField
 * @typedef {{ id: string, label: string, module: string, apiPath?: string, fields: MasterField[], dedicated?: boolean, embedded?: string, docxUpload?: boolean, signatureTyped?: boolean, fromContacts?: boolean, partyType?: string }} MasterEntity
 */

/** @type {MasterEntity[]} */
export const MASTER_ENTITIES = [
  {
    id: 'products',
    label: 'Products',
    module: 'inventory',
    apiPath: '/logistics/products',
    dedicated: true,
    fields: [
      { name: 'productType', label: 'Product type', required: true, type: 'select', options: PRODUCT_TYPES },
      { name: 'brand', label: 'Brand / Manufacturer', required: true },
      { name: 'model', label: 'Model/Variant/Name', required: true },
      { name: 'uomId', label: 'UOM', type: 'select', source: 'uoms' },
      { name: 'unitsPerPack', label: 'Units per pack' },
      { name: 'purchaseCost', label: 'Purchase cost' },
      { name: 'gstRate', label: 'GST / Tax (%)', type: 'select', options: GST_RATE_PRESETS },
      {
        name: 'inventoryType',
        label: 'Inventory type',
        type: 'select',
        options: PRODUCT_INVENTORY_TYPES,
      },
      { name: 'minStock', label: 'Minimum stock level' },
      { name: 'maxStock', label: 'Maximum stock level' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    id: 'parties',
    label: 'Suppliers & Vendors',
    module: 'movement',
    apiPath: '/logistics/parties',
    fromContacts: true,
    fields: [
      {
        name: 'partyType',
        label: 'Type',
        required: true,
        type: 'select',
        options: ['Supplier', 'Vendor'],
      },
      { name: 'name', label: 'Name', required: true },
      { name: 'contactName', label: 'Contact name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'gstin', label: 'GSTIN' },
      { name: 'panCard', label: 'PAN Card' },
    ],
  },
  {
    id: 'expense-categories',
    label: 'Expense Categories',
    module: 'movement',
    apiPath: '/logistics/expense-categories',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'covers', label: 'Covers', type: 'textarea' },
    ],
  },
  {
    id: 'contacts',
    label: 'Contact Directory',
    module: 'document',
    apiPath: '/contacts',
    embedded: 'contacts',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'email', label: 'Email' },
      { name: 'contact', label: 'Phone / contact' },
      { name: 'resourceType', label: 'Resource type' },
      { name: 'profession', label: 'Profession' },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'state', label: 'State' },
      { name: 'city', label: 'City' },
      { name: 'pinCode', label: 'PIN code' },
    ],
  },
  {
    id: 'templates',
    label: 'Document Templates',
    module: 'document',
    apiPath: '/templates/upload',
    embedded: 'templates',
    docxUpload: true,
    fields: [
      { name: 'name', label: 'Template name', required: true },
      { name: 'documentType', label: 'Document type', required: true, type: 'select', options: DOCUMENT_TYPES },
      { name: 'signingType', label: 'Signing type', required: true, type: 'select', options: SIGNING_TYPES },
    ],
  },
  {
    id: 'signatures',
    label: 'Signatures',
    module: 'document',
    apiPath: '/signatures',
    embedded: 'signatures',
    signatureTyped: true,
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'roleLabel', label: 'Role', required: true, type: 'select', options: SIGNATURE_ROLES },
      { name: 'typedName', label: 'Typed signature', required: true },
      { name: 'email', label: 'Email' },
      { name: 'department', label: 'Department' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

/** Hub sidebar groups (mirrors LogisticsMasterPage layout + Document). */
export const MASTER_HUB_GROUPS = [
  {
    id: 'product-masters',
    label: 'Products',
    scope: 'inventory',
    entityIds: ['products'],
  },
  {
    id: 'business-partners',
    label: 'Partners',
    scope: 'logistics',
    entityIds: ['parties'],
  },
  {
    id: 'finance-masters',
    label: 'Finance',
    scope: 'logistics',
    entityIds: ['expense-categories'],
  },
  {
    id: 'document-masters',
    label: 'Document One',
    scope: 'document',
    entityIds: ['contacts', 'templates', 'signatures'],
  },
];

export function getMasterEntity(id) {
  return MASTER_ENTITIES.find((e) => e.id === id) || null;
}

export function entitiesForModule(moduleId) {
  return MASTER_ENTITIES.filter((e) => e.module === moduleId);
}

export function validateMasterPayload(entityId, payload = {}) {
  const entity = getMasterEntity(entityId);
  if (!entity) return 'Unknown master type';
  for (const field of entity.fields) {
    if (!field.required) continue;
    const v = payload[field.name];
    if (v == null || String(v).trim() === '') {
      return `${field.label} is required`;
    }
  }
  if (entity.id === 'contacts') {
    const email = String(payload.email || '').trim();
    const phone = String(payload.contact || payload.phone || '').trim();
    if (!email && !phone) return 'Email or phone is required for a contact';
  }
  return '';
}

export function emptyMasterPayload(entityId) {
  const entity = getMasterEntity(entityId);
  if (!entity) return {};
  const out = {};
  for (const f of entity.fields) {
    if (f.name === 'direction') out[f.name] = 'IN';
    else if (f.name === 'level') out[f.name] = 'Zone';
    else if (f.name === 'productType') out[f.name] = 'Medical Device';
    else if (f.name === 'inventoryType') out[f.name] = 'Multi-use';
    else if (f.name === 'partyType') out[f.name] = 'Supplier';
    else if (f.name === 'gstRate') out[f.name] = '18';
    else if (f.name === 'trackingKind') out[f.name] = 'Serial';
    else if (f.name === 'unitsPerPack') out[f.name] = '1';
    else if (f.name === 'documentType') out[f.name] = 'LEASE';
    else if (f.name === 'signingType') out[f.name] = 'SIGNING';
    else if (f.name === 'roleLabel') out[f.name] = 'HR';
    else out[f.name] = '';
  }
  return out;
}
