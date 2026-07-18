/** Shared helpers for Inward / Outward transaction forms */

export const FALLBACK_PRODUCT = [
  'Device',
  'Consumable',
  'Accessory',
  'Spare Part',
  'Document',
  'Misc',
];

export const FALLBACK_DELIVERY = [
  'Hand Delivery',
  'Regular Courier',
  'Apex',
  'Porter',
  'Other',
  'Blue Dart',
  'DTDC',
  'Other Courier',
];
export const FALLBACK_COURIER = [
  'Regular Courier',
  'Apex',
  'Other',
  'Blue Dart',
  'DTDC',
  'Other Courier',
];

export const FALLBACK_CAT_DEFAULTS = {
  Device: { expiryApplicable: false, trackingKind: 'Serial' },
  Consumable: { expiryApplicable: true, trackingKind: 'Batch' },
  Accessory: { expiryApplicable: false, trackingKind: 'Serial' },
  'Spare Part': { expiryApplicable: false, trackingKind: 'Batch + Serial' },
  Document: { expiryApplicable: false, trackingKind: 'None' },
  Misc: { expiryApplicable: false, trackingKind: 'None' },
  // Legacy keys still present on older stock / txn rows
  'Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Non-Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Spare Part / Accessory': { expiryApplicable: false, trackingKind: 'Batch + Serial' },
  Miscellaneous: { expiryApplicable: false, trackingKind: 'None' },
};

/** Normalize legacy product types to the current Product Master set. */
export function resolveProductType(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  const aliases = {
    Device: 'Device',
    Consumable: 'Consumable',
    Accessory: 'Accessory',
    'Spare Part': 'Spare Part',
    Document: 'Document',
    Misc: 'Misc',
    'Medical Device': 'Device',
    'Non-Medical Device': 'Device',
    'Spare Part / Accessory': 'Spare Part',
    Miscellaneous: 'Misc',
    Documents: 'Document',
    Others: 'Misc',
    Other: 'Misc',
  };
  if (aliases[v]) return aliases[v];
  const hit = Object.entries(aliases).find(([k]) => k.toLowerCase() === v.toLowerCase());
  return hit?.[1] || v;
}

export function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyTxnForm(user, { entryType = 'Inward', warehouseId = '' } = {}) {
  return {
    uniqueKey: '',
    warehouseId,
    entryType,
    transactionDateTime: nowLocal(),
    productType: 'Consumable',
    productId: '',
    productName: '',
    programProject: '',
    qty: '1',
    perUnitCost: '',
    state: '',
    city: '',
    contactId: '',
    recipientName: '',
    empId: '',
    number: '',
    expiryApplicable: true,
    trackingKind: 'Batch',
    expiryDate: '',
    batchOrSerial: '',
    deliveryMode: 'Hand Delivery',
    awbNumber: '',
    remark: '',
    createdBy: user?.email || user?.fullName || '',
    assetRequestId: '',
  };
}

export function isInwardRow(entryType) {
  const t = String(entryType || '');
  return /^inward/i.test(t) || t === 'Return';
}

export function isOutwardRow(entryType) {
  const t = String(entryType || '');
  return /^outward/i.test(t) || t === 'Transfer';
}

export function Field({ label, required, children, hint }) {
  return (
    <div className="field">
      <label>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {hint ? (
        <span className="muted" style={{ fontSize: '0.72rem' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
