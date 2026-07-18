/** Shared helpers for Inward / Outward transaction forms */

export const FALLBACK_PRODUCT = [
  'Medical Device',
  'Non-Medical Device',
  'Consumable',
  'Spare Part / Accessory',
  'Document',
  'Miscellaneous',
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
  'Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Non-Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  Consumable: { expiryApplicable: true, trackingKind: 'Batch' },
  'Spare Part / Accessory': { expiryApplicable: false, trackingKind: 'Batch + Serial' },
  Document: { expiryApplicable: false, trackingKind: 'None' },
  Miscellaneous: { expiryApplicable: false, trackingKind: 'None' },
};

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
