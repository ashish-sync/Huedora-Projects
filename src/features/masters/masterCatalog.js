/** Shared catalog for Master One hub + Request One “Master One Request”. */

export const MASTER_MODULES = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'movement', label: 'Movement One' },
  { id: 'document', label: 'Document One' },
];

export const PRODUCT_TYPES = ['Device', 'Consumable', 'Accessory', 'Spare Part', 'Document', 'Misc'];
export const LOCATION_LEVELS = ['Zone', 'Room', 'Rack', 'Shelf', 'Bin'];
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
      { name: 'name', label: 'Name', required: true },
      { name: 'productType', label: 'Product type', required: true, type: 'select', options: PRODUCT_TYPES },
      { name: 'categoryId', label: 'Category', required: true, type: 'select', source: 'categories' },
      { name: 'brand', label: 'Brand', required: true },
      { name: 'manufacturer', label: 'Manufacturer', required: true },
      { name: 'uomId', label: 'UOM', type: 'select', source: 'uoms' },
      { name: 'trackingKind', label: 'Tracking', type: 'select', options: TRACKING_KINDS },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    id: 'categories',
    label: 'Product Categories',
    module: 'inventory',
    apiPath: '/logistics/categories',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    id: 'uoms',
    label: 'Units of Measure',
    module: 'inventory',
    apiPath: '/logistics/uoms',
    fields: [{ name: 'name', label: 'Name', required: true }],
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    module: 'inventory',
    apiPath: '/logistics/warehouses',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'address', label: 'Address', type: 'textarea' },
    ],
  },
  {
    id: 'locations',
    label: 'Locations',
    module: 'inventory',
    apiPath: '/logistics/locations',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'level', label: 'Level', required: true, type: 'select', options: LOCATION_LEVELS },
      { name: 'warehouseId', label: 'Warehouse', required: true, type: 'select', source: 'warehouses' },
      { name: 'parentId', label: 'Parent location', type: 'select', source: 'locations' },
    ],
  },
  {
    id: 'stock-statuses',
    label: 'Stock Statuses',
    module: 'inventory',
    apiPath: '/logistics/stock-statuses',
    fields: [{ name: 'name', label: 'Name', required: true }],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    module: 'movement',
    apiPath: '/logistics/suppliers',
    fromContacts: true,
    partyType: 'Supplier',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'contactName', label: 'Contact name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    module: 'movement',
    apiPath: '/logistics/vendors',
    fromContacts: true,
    partyType: 'Vendor',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'contactName', label: 'Contact name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
    ],
  },
  {
    id: 'transporters',
    label: 'Transporters',
    module: 'movement',
    apiPath: '/logistics/transporters',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'contactName', label: 'Contact name' },
      { name: 'email', label: 'Email' },
      { name: 'phone', label: 'Phone' },
    ],
  },
  {
    id: 'movement-types',
    label: 'Process / Movement Types',
    module: 'movement',
    apiPath: '/logistics/movement-types',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'direction', label: 'Direction', type: 'select', options: ['IN', 'OUT'] },
    ],
  },
  {
    id: 'reason-codes',
    label: 'Reason Codes',
    module: 'movement',
    apiPath: '/logistics/reason-codes',
    fields: [{ name: 'name', label: 'Name', required: true }],
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
    label: 'Business Partners',
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
    id: 'pin-codes',
    label: 'Geography / PIN',
    module: 'document',
    apiPath: '/geo/pin-codes',
    embedded: 'pin-codes',
    fields: [
      { name: 'pinCode', label: 'PIN code', required: true },
      { name: 'stateId', label: 'State', required: true, type: 'geo-state' },
      { name: 'cityId', label: 'City', required: true, type: 'geo-city' },
      { name: 'locality', label: 'Locality' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
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
    entityIds: ['products', 'categories', 'uoms'],
  },
  {
    id: 'inventory-masters',
    label: 'Inventory',
    scope: 'inventory',
    entityIds: ['warehouses', 'locations', 'stock-statuses'],
  },
  {
    id: 'business-partners',
    label: 'Partners',
    scope: 'logistics',
    entityIds: ['suppliers', 'vendors', 'transporters'],
  },
  {
    id: 'process-masters',
    label: 'Process',
    scope: 'logistics',
    entityIds: ['movement-types', 'reason-codes'],
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
    entityIds: ['contacts', 'pin-codes', 'templates', 'signatures'],
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
  if (entity.id === 'pin-codes') {
    const pin = String(payload.pinCode || '').replace(/\D+/g, '');
    if (!/^\d{6}$/.test(pin)) return 'PIN code must be 6 digits';
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
    else if (f.name === 'productType') out[f.name] = 'Device';
    else if (f.name === 'trackingKind') out[f.name] = 'Serial';
    else if (f.name === 'documentType') out[f.name] = 'LEASE';
    else if (f.name === 'signingType') out[f.name] = 'SIGNING';
    else if (f.name === 'roleLabel') out[f.name] = 'HR';
    else out[f.name] = '';
  }
  return out;
}
