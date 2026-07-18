/** Shared helpers for Inward / Outward transaction forms */

export const FALLBACK_PRODUCT = [
  'Medical Device',
  'Non-Medical Device',
  'Peripheral Device',
  'Accessory',
  'Spare Part',
  'Consumable',
  'Document',
  'Other',
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

/** Same issue kinds as Request One → Goods Issue */
export const GOODS_ISSUE_KINDS = ['Fresh Dispatch', 'Inter Transfer', 'Recall / Pickup'];

export const FALLBACK_CAT_DEFAULTS = {
  'Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Non-Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Peripheral Device': { expiryApplicable: false, trackingKind: 'Serial' },
  Accessory: { expiryApplicable: false, trackingKind: 'Serial' },
  'Spare Part': { expiryApplicable: false, trackingKind: 'Batch + Serial' },
  Consumable: { expiryApplicable: true, trackingKind: 'Batch' },
  Document: { expiryApplicable: false, trackingKind: 'None' },
  Other: { expiryApplicable: false, trackingKind: 'None' },
  // Legacy keys still present on older stock / txn rows
  Device: { expiryApplicable: false, trackingKind: 'Serial' },
  Misc: { expiryApplicable: false, trackingKind: 'None' },
  'Spare Part / Accessory': { expiryApplicable: false, trackingKind: 'Batch + Serial' },
  Miscellaneous: { expiryApplicable: false, trackingKind: 'None' },
};

/** Normalize legacy product types to the current Product Master set. */
export function resolveProductType(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  const aliases = {
    'Medical Device': 'Medical Device',
    'Non-Medical Device': 'Non-Medical Device',
    'Peripheral Device': 'Peripheral Device',
    Accessory: 'Accessory',
    'Spare Part': 'Spare Part',
    Consumable: 'Consumable',
    Consumables: 'Consumable',
    Document: 'Document',
    Other: 'Other',
    Device: 'Medical Device',
    Peripheral: 'Peripheral Device',
    Misc: 'Other',
    'Spare Part / Accessory': 'Spare Part',
    Miscellaneous: 'Other',
    Documents: 'Document',
    Others: 'Other',
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
    uomId: '',
    perUnitCost: '',
    invoiceAmount: '',
    state: '',
    city: '',
    contactId: '',
    supplierId: '',
    vendor: '',
    recipientName: '',
    empId: '',
    number: '',
    expiryApplicable: true,
    trackingKind: 'Batch',
    expiryDate: '',
    serialNumber: '',
    batchNumber: '',
    approvedBy: '',
    batchOrSerial: '',
    deliveryMode: 'Hand Delivery',
    awbNumber: '',
    remark: '',
    logisticsKind: 'Fresh Dispatch',
    priority: 'Medium',
    preferredDate: '',
    logisticsProducts: [{ productType: '', productId: '', productName: '', qty: '1' }],
    logisticsProductsConfirmed: false,
    fromContactId: '',
    fromName: '',
    fromNumber: '',
    fromAddress: '',
    fromPinCode: '',
    fromCity: '',
    fromState: '',
    toContactId: '',
    toName: '',
    toNumber: '',
    toAddress: '',
    toPinCode: '',
    toCity: '',
    toState: '',
    createdBy: user?.email || user?.fullName || '',
    assetRequestId: '',
  };
}

/** Whole months from asOf (YYYY-MM-DD) until expiryDate. */
export function monthsUntilExpiry(expiryDate, asOf = new Date()) {
  const exp = new Date(String(expiryDate || '').slice(0, 10));
  const from = new Date(String(asOf || '').slice(0, 10));
  if (Number.isNaN(exp.getTime()) || Number.isNaN(from.getTime())) return null;
  let months = (exp.getFullYear() - from.getFullYear()) * 12 + (exp.getMonth() - from.getMonth());
  if (exp.getDate() < from.getDate()) months -= 1;
  return months;
}

export const SHORT_EXPIRY_APPROVAL_MONTHS = 12;

export function requiresShortExpiryApproval(expiryDate, asOf = new Date()) {
  const months = monthsUntilExpiry(expiryDate, asOf);
  if (months == null) return false;
  return months < SHORT_EXPIRY_APPROVAL_MONTHS;
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
