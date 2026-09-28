/** Shared helpers for Inward / Outward transaction forms */

import { PRODUCT_TYPES, resolveProductType } from '../../shared/productTypes.js';

export const FALLBACK_PRODUCT = [...PRODUCT_TYPES];

export const FALLBACK_DELIVERY = [
  'Courier',
  'Porter',
  'Hand Delivery',
];
export const FALLBACK_COURIER = ['Courier'];

/** Fixed Tylo Care HQ used as Origin (Fresh Dispatch) or Destination (Recall / Pickup). */
export const FIXED_POD_HQ = {
  pinCode: '400063',
  name: 'Tylo Care',
  number: '022-65911206',
  address: '507-508 De Elmas, Opp. Ginger Hotel, Jay Prakash Nagar, Goregaon East',
  city: 'Mumbai',
  state: 'Maharashtra',
};

/** Fixed ship-from for POD / courier bookings (Mumbai HQ). */
export const FIXED_POD_ORIGIN = {
  fromPinCode: FIXED_POD_HQ.pinCode,
  fromName: FIXED_POD_HQ.name,
  fromNumber: FIXED_POD_HQ.number,
  fromAddress: FIXED_POD_HQ.address,
};

export function applyFixedPodOrigin(target = {}) {
  return {
    ...target,
    ...FIXED_POD_ORIGIN,
    fromCity: FIXED_POD_HQ.city,
    fromState: FIXED_POD_HQ.state,
  };
}

/** Map HQ address onto from* or to* party fields. */
export function fixedPodPartyFields(prefix = 'from') {
  const p = String(prefix || 'from');
  return {
    [`${p}ContactId`]: '',
    [`${p}Name`]: FIXED_POD_HQ.name,
    [`${p}Number`]: FIXED_POD_HQ.number,
    [`${p}Address`]: FIXED_POD_HQ.address,
    [`${p}PinCode`]: FIXED_POD_HQ.pinCode,
    [`${p}City`]: FIXED_POD_HQ.city,
    [`${p}State`]: FIXED_POD_HQ.state,
  };
}

/** POD Content Type = Product category + Model/Variant/Name */
export function buildPodContentType(productType, productName) {
  const cat = String(productType || '').trim();
  const name = String(productName || '').trim();
  if (cat && name) return `${cat} — ${name}`;
  return cat || name || '';
}

/** DTDC Excel / booking sheet Service Type codes. */
export function mapPodServiceType(courierNameOrCode) {
  const s = String(courierNameOrCode || '').trim();
  if (!s) return '';
  const upper = s.toUpperCase().replace(/\s+/g, ' ');
  if (upper === 'PREMIUM' || upper === 'PRIORITY' || upper === 'GROUND EXPRESS') return upper;
  if (/\bPREMIUM\b/i.test(s)) return 'PREMIUM';
  if (/\bPRIORITY\b/i.test(s)) return 'PRIORITY';
  if (/GROUND\s*EXPRESS/i.test(s)) return 'GROUND EXPRESS';
  return s;
}

/** DTDC Excel Courier Type — DOCUMENT only when Product Category is Document. */
export function mapPodCourierType(productType) {
  const pt = resolveProductType(productType) || String(productType || '').trim();
  return pt === 'Document' ? 'DOCUMENT' : 'NON DOCUMENT';
}

/** @deprecated Prefer quoteCourierRateCard (Air slabs from Mumbai). Kept for legacy refs. */
export const FALLBACK_COURIER_RATES = [
  { name: 'Delhivery Air', ratePerKg: 88, minCharge: 44 },
  { name: 'DTDC Priority Air', ratePerKg: 54, minCharge: 27 },
  { name: 'DTDC Premium Air', ratePerKg: 90, minCharge: 45 },
  { name: 'Blue Dart Air', ratePerKg: 116, minCharge: 58 },
];

export function estimateCourierCharge(weightKg, ratePerKg, minCharge = 0) {
  const w = Number(weightKg);
  const rate = Number(ratePerKg) || 0;
  const min = Number(minCharge) || 0;
  if (!Number.isFinite(w) || w <= 0 || rate <= 0) return null;
  return Math.max(min, Math.round(rate * w * 100) / 100);
}

export const ISSUE_PRIORITIES = ['High', 'Medium', 'Low'];

/** Packer confirmation when preparing a package from a Goods Issuance Request */
export const PACKAGE_STATUSES = [
  'Package ready',
  'Partially ready',
  'No stock',
];

export const DELIVERY_MODE_ALIASES = {
  'Regular Courier': 'Courier',
  Apex: 'Courier',
  Other: 'Courier',
  'Blue Dart': 'Courier',
  DTDC: 'Courier',
  'Other Courier': 'Courier',
  Fragile: 'Courier',
  'Air Delivery': 'Courier',
  'Hand-carry': 'Hand Delivery',
  Road: 'Courier',
};

export function mapDeliveryMode(mode) {
  const raw = String(mode || '').trim();
  if (!raw) return 'Hand Delivery';
  if (FALLBACK_DELIVERY.includes(raw)) return raw;
  return DELIVERY_MODE_ALIASES[raw] || raw;
}

/** Volumetric weight (kg) = L × H × W (cm) / 5000 */
export function volumetricWeightKg(lengthCm, heightCm, widthCm) {
  const l = Number(lengthCm);
  const h = Number(heightCm);
  const w = Number(widthCm);
  if (![l, h, w].every((n) => Number.isFinite(n) && n > 0)) return null;
  return (l * h * w) / 5000;
}

/** Applicable weight = max(package weight kg, volumetric weight kg) */
export function applicableWeightKg(packageWeightKg, lengthCm, heightCm, widthCm) {
  const actual = Number(packageWeightKg);
  const volumetric = volumetricWeightKg(lengthCm, heightCm, widthCm);
  const actualOk = Number.isFinite(actual) && actual > 0 ? actual : null;
  if (actualOk == null && volumetric == null) return null;
  if (actualOk == null) return volumetric;
  if (volumetric == null) return actualOk;
  return Math.max(actualOk, volumetric);
}

export function formatWeightKg(value) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
}

/** Same issue kinds as Request One → Goods Issue */
export const GOODS_ISSUE_KINDS = ['Fresh Dispatch', 'Inter Transfer', 'Recall / Pickup'];

export const FALLBACK_CAT_DEFAULTS = {
  'Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Non-Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  Peripheral: { expiryApplicable: false, trackingKind: 'Serial' },
  Consumable: { expiryApplicable: true, trackingKind: 'Batch' },
  'Spare Part': { expiryApplicable: false, trackingKind: 'Batch' },
  Document: { expiryApplicable: false, trackingKind: 'None' },
  Other: { expiryApplicable: false, trackingKind: 'None' },
  // Legacy keys still present on older stock / txn rows
  Device: { expiryApplicable: false, trackingKind: 'Serial' },
  'Peripheral Device': { expiryApplicable: false, trackingKind: 'Serial' },
  Accessory: { expiryApplicable: false, trackingKind: 'Serial' },
  Misc: { expiryApplicable: false, trackingKind: 'None' },
  'Spare Part / Accessory': { expiryApplicable: false, trackingKind: 'Batch' },
  Miscellaneous: { expiryApplicable: false, trackingKind: 'None' },
};

export { resolveProductType };

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
    /** Rate-card courier id (Book POD merged into Prepare package) */
    podCourierId: '',
    remark: '',
    logisticsKind: 'Fresh Dispatch',
    priority: 'Medium',
    packageStatus: '',
    packageNote: '',
    packageWeight: '',
    packageLength: '',
    packageHeight: '',
    packageWidth: '',
    declaredPrice: '',
    numberOfPieces: '1',
    toAddressLine2: '',
    riskSurcharge: 'NO',
    contentType: '',
    requestRemarks: '',
    logisticsProducts: [{ productType: '', productId: '', productName: '', qty: '1' }],
    logisticsProductsConfirmed: false,
    fromContactId: '',
    ...FIXED_POD_ORIGIN,
    fromCity: 'Mumbai',
    fromState: 'Maharashtra',
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

/** Goods issue list filter — mutually exclusive buckets (no Packed/POD overlap). */
export const GOODS_ISSUE_STATUS_FILTERS = [
  { value: 'Open', label: 'In progress' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'RTO', label: 'RTO' },
  { value: 'Closed', label: 'Closed' },
  { value: 'All', label: 'All' },
];

export const GOODS_ISSUE_PIPELINE_STAGES = [
  { id: 'booked', label: 'Booked' },
  { id: 'approved', label: 'Approved' },
  { id: 'packed', label: 'Packed' },
  { id: 'pod', label: 'POD Booked' },
  { id: 'delivery', label: 'In transit' },
  { id: 'outcome', label: 'Outcome' },
];

export const OUTWARD_PACKED_DISPATCH_STATUS = 'Packed';
export const OUTWARD_POD_BOOKED_STATUS = 'POD Booked';
export const OUTWARD_TERMINAL_DISPATCH_STATUSES = ['Delivered', 'RTO', 'Closed'];

export function resolveGoodsIssuePipelineStage({
  requestStatus = '',
  packageStatus = '',
  dispatchStatus = '',
  podBookedAt = '',
  deliveryOutcome = '',
  allLinesPacked = false,
  pipeline = null,
} = {}) {
  if (pipeline?.id) {
    const idx = GOODS_ISSUE_PIPELINE_STAGES.findIndex((s) => s.id === pipeline.id);
    return {
      index: idx >= 0 ? idx : 0,
      id: pipeline.id,
      label: pipeline.label || GOODS_ISSUE_PIPELINE_STAGES[idx]?.label || '',
      outcome: pipeline.outcome || '',
    };
  }

  const req = String(requestStatus || '').trim().toUpperCase();
  const pkg = String(packageStatus || '').trim();
  const dispatch = String(dispatchStatus || '').trim();
  const outcome = String(deliveryOutcome || dispatch || '').trim();

  if (OUTWARD_TERMINAL_DISPATCH_STATUSES.includes(outcome)) {
    return { index: 5, id: 'outcome', label: 'Outcome', outcome };
  }
  if (req === 'COMPLETED' || req === 'REJECTED' || req === 'CANCELLED') {
    return {
      index: 5,
      id: 'outcome',
      label: 'Outcome',
      outcome: req === 'COMPLETED' ? outcome || 'Completed' : req,
    };
  }
  if (dispatch === OUTWARD_POD_BOOKED_STATUS || podBookedAt) {
    return { index: 4, id: 'delivery', label: 'In transit', outcome: '' };
  }
  if (
    dispatch === OUTWARD_PACKED_DISPATCH_STATUS ||
    allLinesPacked ||
    /^package ready$/i.test(pkg) ||
    /^partially ready$/i.test(pkg)
  ) {
    return { index: 3, id: 'pod', label: 'POD Booked', outcome: '' };
  }
  if (req === 'APPROVED') {
    return { index: 2, id: 'packed', label: 'Packed', outcome: '' };
  }
  if (req === 'REQUESTED') {
    return { index: 1, id: 'approved', label: 'Approved', outcome: '' };
  }
  return { index: 0, id: 'booked', label: 'Booked', outcome: '' };
}

export function isInwardRow(entryType) {
  const t = String(entryType || '');
  return /^inward/i.test(t) || t === 'Return';
}

export function isOutwardRow(entryType) {
  const t = String(entryType || '');
  return /^outward/i.test(t) || t === 'Transfer';
}

export function Field({ label, required, children, hint, className = '' }) {
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {hint ? <span className="muted logistics-prepare-hint">{hint}</span> : null}
    </div>
  );
}
