import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plane, Truck } from 'lucide-react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api, downloadExcel } from '../../shared/api.js';
import { fetchContactsList } from '../../shared/contactsApi.js';
import { productAssetName, productOptionLabel } from '../../shared/productMasterLabel.js';
import { formatDate, formatDateTime } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import {
  FALLBACK_CAT_DEFAULTS,
  FALLBACK_DELIVERY,
  FALLBACK_PRODUCT,
  Field,
  FIXED_POD_ORIGIN,
  applyFixedPodOrigin,
  fixedPodPartyFields,
  buildPodContentType,
  mapPodCourierType,
  mapPodServiceType,
  GOODS_ISSUE_KINDS,
  ISSUE_PRIORITIES,
  PACKAGE_STATUSES,
  GOODS_ISSUE_STATUS_FILTERS,
  applicableWeightKg,
  emptyTxnForm,
  formatWeightKg,
  mapDeliveryMode,
  nowLocal,
  resolveProductType,
  volumetricWeightKg,
} from './logisticsTxnShared.jsx';
import { quoteCourierRateCard } from './courierRateCard.js';

function normalizeIssueKind(raw) {
  const v = String(raw || '').trim();
  if (v === 'Goods Issue' || v === 'Dispatch' || v === 'Delivery') return 'Fresh Dispatch';
  return v || 'Fresh Dispatch';
}

function needsFromContact(kind) {
  const k = normalizeIssueKind(kind);
  return k === 'Inter Transfer' || k === 'Recall / Pickup';
}

function needsToContact(kind) {
  const k = normalizeIssueKind(kind);
  // Fresh Dispatch: recipient only; Recall + Inter Transfer: sender and recipient
  return (
    k === 'Fresh Dispatch' || k === 'Inter Transfer' || k === 'Recall / Pickup'
  );
}

function entryTypeForKind(kind) {
  return normalizeIssueKind(kind) === 'Recall / Pickup' ? 'Return' : 'Outward';
}

function emptyIssueProduct() {
  return {
    productType: '',
    productId: '',
    productName: '',
    qty: '1',
    trackingKind: 'None',
    expiryApplicable: false,
    serialNumber: '',
    batchNumber: '',
    expiryDate: '',
  };
}

function lineTrackingMeta(productType, product, categoryDefaults) {
  const type = resolveProductType(productType || product?.productType || '');
  const defaults = categoryDefaults?.[type] || FALLBACK_CAT_DEFAULTS[type] || {};
  const trackingKind = product?.trackingKind || defaults.trackingKind || 'None';
  const expiryApplicable =
    product?.expiryApplicable != null ? !!product.expiryApplicable : !!defaults.expiryApplicable;
  return { trackingKind, expiryApplicable };
}

function lineNeedsSerial(trackingKind) {
  return trackingKind === 'Serial' || trackingKind === 'Batch + Serial';
}

function lineNeedsBatch(trackingKind) {
  return trackingKind === 'Batch' || trackingKind === 'Batch + Serial';
}

function lineBatchOrSerial(line) {
  const kind = line.trackingKind || 'None';
  if (kind === 'None') return 'N/A';
  if (kind === 'Serial') return String(line.serialNumber || '').trim();
  if (kind === 'Batch') return String(line.batchNumber || '').trim();
  // Batch + Serial: prefer combined, fall back to either
  const serial = String(line.serialNumber || '').trim();
  const batch = String(line.batchNumber || '').trim();
  if (serial && batch) return `${batch} / ${serial}`;
  return serial || batch;
}

/** Aggregate Available inward stock rows into batch/expiry lots (FEFO order). */
function normalizeStockLots(rows = []) {
  const byKey = new Map();
  for (const row of rows) {
    const qty = Number(row.quantity ?? row.qty) || 0;
    if (qty <= 0) continue;
    const batchNumber = String(row.batchNumber || '').trim();
    const expiryDate = String(row.expiryDate || '').slice(0, 10);
    const serialNumber = String(row.serialNumber || '').trim();
    const key = `${batchNumber}|${expiryDate}|${serialNumber}`;
    const prev = byKey.get(key);
    if (prev) {
      prev.qty += qty;
    } else {
      byKey.set(key, { batchNumber, expiryDate, serialNumber, qty });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return String(a.batchNumber).localeCompare(String(b.batchNumber));
  });
}

function batchOptionsFromLots(lots, expiryFilter = '') {
  const seen = new Set();
  const out = [];
  for (const lot of lots) {
    if (!lot.batchNumber) continue;
    if (expiryFilter && lot.expiryDate && lot.expiryDate !== expiryFilter) continue;
    if (seen.has(lot.batchNumber)) continue;
    seen.add(lot.batchNumber);
    const qty = lots
      .filter(
        (l) =>
          l.batchNumber === lot.batchNumber &&
          (!expiryFilter || !l.expiryDate || l.expiryDate === expiryFilter)
      )
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    out.push({ value: lot.batchNumber, qty });
  }
  return out;
}

function expiryOptionsFromLots(lots, batchFilter = '') {
  const seen = new Set();
  const out = [];
  for (const lot of lots) {
    if (!lot.expiryDate) continue;
    if (batchFilter && lot.batchNumber && lot.batchNumber !== batchFilter) continue;
    if (seen.has(lot.expiryDate)) continue;
    seen.add(lot.expiryDate);
    const qty = lots
      .filter(
        (l) =>
          l.expiryDate === lot.expiryDate &&
          (!batchFilter || !l.batchNumber || l.batchNumber === batchFilter)
      )
      .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
    out.push({ value: lot.expiryDate, qty });
  }
  return out;
}

function serialOptionsFromLots(lots, batchFilter = '', expiryFilter = '') {
  const seen = new Set();
  const out = [];
  for (const lot of lots) {
    if (!lot.serialNumber) continue;
    if (batchFilter && lot.batchNumber && lot.batchNumber !== batchFilter) continue;
    if (expiryFilter && lot.expiryDate && lot.expiryDate !== expiryFilter) continue;
    if (seen.has(lot.serialNumber)) continue;
    seen.add(lot.serialNumber);
    out.push(lot.serialNumber);
  }
  return out;
}

function todayLocalDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function contactNumber(contact) {
  return contact?.contact || contact?.mobile || '';
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function contactSnapshot(contact, prefix) {
  return {
    [`${prefix}ContactId`]: contact?._id ? String(contact._id) : '',
    [`${prefix}Name`]: contact?.name || '',
    [`${prefix}Number`]: contactNumber(contact),
    [`${prefix}Address`]: contact?.address || '',
    [`${prefix}PinCode`]: contact?.pinCode || '',
    [`${prefix}City`]: contact?.city || '',
    [`${prefix}State`]: contact?.state || '',
  };
}

function emptyContactPrefix(prefix) {
  return {
    [`${prefix}ContactId`]: '',
    [`${prefix}Name`]: '',
    [`${prefix}Number`]: '',
    [`${prefix}Address`]: '',
    [`${prefix}PinCode`]: '',
    [`${prefix}City`]: '',
    [`${prefix}State`]: '',
  };
}

function partyFromRequest(req, prefix) {
  const contact = req?.[`${prefix}ContactId`];
  const contactObj = contact && typeof contact === 'object' ? contact : null;
  return {
    [`${prefix}ContactId`]: refId(req?.[`${prefix}ContactId`]),
    [`${prefix}Name`]:
      req?.[`${prefix}Name`] || contactObj?.name || '',
    [`${prefix}Number`]:
      req?.[`${prefix}Number`] ||
      contactObj?.contact ||
      contactObj?.mobile ||
      '',
    [`${prefix}Address`]:
      req?.[`${prefix}Address`] || contactObj?.address || '',
    [`${prefix}PinCode`]:
      req?.[`${prefix}PinCode`] || contactObj?.pinCode || '',
    [`${prefix}City`]:
      req?.[`${prefix}City`] || contactObj?.city || '',
    [`${prefix}State`]:
      req?.[`${prefix}State`] || contactObj?.state || '',
  };
}

function syncRecipientAliases(fields) {
  return {
    ...fields,
    contactId: fields.toContactId || '',
    recipientName: fields.toName || '',
    number: fields.toNumber || '',
    city: fields.toCity || '',
    state: fields.toState || '',
  };
}

/** Contact Directory picker with name, number, address, pin, city, state */
function DirectoryPartyFields({ label, prefix, contacts, form, setForm }) {
  const idKey = `${prefix}ContactId`;
  const fields = [
    { suffix: 'Name', label: 'Name', value: (c) => c.name || '' },
    { suffix: 'Number', label: 'Number', value: contactNumber },
    { suffix: 'PinCode', label: 'Pin code', value: (c) => c.pinCode || '' },
    { suffix: 'Address', label: 'Address Line 1', value: (c) => c.address || '' },
    { suffix: 'City', label: 'City', value: (c) => c.city || '' },
    { suffix: 'State', label: 'State', value: (c) => c.state || '' },
  ];

  const matchingBefore = (fieldIndex) =>
    contacts.filter((contact) =>
      fields.slice(0, fieldIndex).every(({ suffix, value }) => {
        const selected = form[`${prefix}${suffix}`];
        return !selected || String(value(contact)) === String(selected);
      })
    );

  const selectContact = (id) => {
    const contact = contacts.find((item) => String(item._id) === String(id));
    setForm((prev) => ({
      ...prev,
      ...(contact ? contactSnapshot(contact, prefix) : emptyContactPrefix(prefix)),
      ...(prefix === 'to'
        ? {
            contactId: contact?._id ? String(contact._id) : '',
            recipientName: contact?.name || '',
            number: contactNumber(contact),
            city: contact?.city || '',
            state: contact?.state || '',
          }
        : {}),
    }));
  };

  const selectField = (fieldIndex, selected) => {
    const field = fields[fieldIndex];
    const candidates = matchingBefore(fieldIndex).filter(
      (contact) => String(field.value(contact)) === String(selected)
    );
    if (candidates.length === 1) {
      const contact = candidates[0];
      setForm((prev) => ({
        ...prev,
        ...contactSnapshot(contact, prefix),
        ...(prefix === 'to'
          ? {
              contactId: String(contact._id),
              recipientName: contact.name || '',
              number: contactNumber(contact),
              city: contact.city || '',
              state: contact.state || '',
            }
          : {}),
      }));
      return;
    }
    const changes = { [idKey]: '', [`${prefix}${field.suffix}`]: selected };
    fields.slice(fieldIndex + 1).forEach(({ suffix }) => {
      changes[`${prefix}${suffix}`] = '';
    });
    if (prefix === 'to') {
      changes.contactId = '';
      changes.recipientName = field.suffix === 'Name' ? selected : '';
    }
    setForm((prev) => ({ ...prev, ...changes }));
  };

  return (
    <fieldset className="arq-contact-group arq-span">
      <legend>{label}</legend>
      <div className="arq-contact-grid">
        <div className="field">
          <label>Contact Directory *</label>
          <AdaptiveSelect required value={form[idKey] || ''} onChange={(e) => selectContact(e.target.value)}>
            <option value="">Select contact</option>
            {contacts.map((contact) => (
              <option key={contact._id} value={contact._id}>
                {contact.name || 'Unnamed'}
                {contact.city ? `: ${contact.city}` : ''}
              </option>
            ))}
          </AdaptiveSelect>
        </div>
        {fields.map((field, fieldIndex) => {
          const options = uniqueSorted(matchingBefore(fieldIndex).map(field.value));
          return (
            <div
              className={`field arq-contact-field arq-contact-field--${String(field.suffix).toLowerCase()}`}
              key={field.suffix}
            >
              <label>{field.label}</label>
              <AdaptiveSelect
                value={form[`${prefix}${field.suffix}`] || ''}
                onChange={(e) => selectField(fieldIndex, e.target.value)}
              >
                <option value="">Select</option>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function refId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

function requestLines(request) {
  if (Array.isArray(request?.logisticsProducts) && request.logisticsProducts.length) {
    return request.logisticsProducts;
  }
  return [
    {
      productType: request?.productType || '',
      productId: request?.productId || '',
      productName: request?.assetName || request?.productName || '',
      qty: request?.qty || 1,
    },
  ];
}

function lineId(line) {
  return String(line?.assetRequestLineId || line?.lineId || line?._id || line?.id || '');
}

function lineIsFulfilled(line) {
  const status = String(line?.fulfillmentStatus || line?.status || '').toUpperCase();
  const packageStatus = String(line?.packageStatus || '').trim();
  return (
    status === 'FULFILLED' ||
    status === 'DISPATCHED' ||
    Boolean(line?.fulfilledAt || line?.outwardTransactionId || line?.dispatchId) ||
    PACKAGE_STATUSES.includes(packageStatus)
  );
}

function linePackageStatus(request, line, index) {
  if (String(line?.packageStatus || '').trim()) return String(line.packageStatus).trim();
  if (requestLineIsFulfilled(request, line, index)) return 'Package ready';
  return '';
}

function packageActionLabel(request, line, index) {
  const status = linePackageStatus(request, line, index);
  if (!status) return 'Prepare package';
  if (status === 'No stock') return 'No stock';
  return 'Prepared';
}

function fulfilledLineIds(request) {
  const candidates = [
    request?.fulfilledLineIds,
    request?.fulfilledAssetRequestLineIds,
    request?.fulfilledProductLineIds,
    request?.fulfilledLogisticsProductLineIds,
    request?.logisticsFulfillment?.fulfilledLineIds,
  ];
  return new Set(candidates.find(Array.isArray)?.map(String) || []);
}

function requestLineIsFulfilled(request, line, index) {
  if (lineIsFulfilled(line)) return true;
  const fulfilledIds = fulfilledLineIds(request);
  const id = lineId(line);
  return Boolean((id && fulfilledIds.has(id)) || fulfilledIds.has(String(index)));
}

function fulfillmentProgress(request) {
  const lines = requestLines(request);
  const fulfilled = lines.filter((line, index) => requestLineIsFulfilled(request, line, index)).length;
  return { lines, fulfilled, total: lines.length, allFulfilled: lines.length > 0 && fulfilled === lines.length };
}

function mapRequestPriority(priority) {
  const raw = String(priority || '').trim();
  if (ISSUE_PRIORITIES.includes(raw)) return raw;
  if (/^urgent$/i.test(raw)) return 'High';
  if (/^not urgent$/i.test(raw)) return 'Medium';
  return 'Medium';
}

function resolveDispatchStatus(row) {
  const s = String(row?.dispatchStatus || '').trim();
  if (s) return s;
  const entry = String(row?.entryType || '');
  if (entry === 'Outward' || entry === 'Return' || !entry) return 'Open';
  return '';
}

function isDispatchTerminal(status) {
  return ['Delivered', 'RTO', 'Closed'].includes(String(status || '').trim());
}

function isDispatchOpen(row) {
  return !isDispatchTerminal(resolveDispatchStatus(row));
}

const POD_TRACK_URL = 'https://www.dtdc.com/trackshipment';

export default function LogisticsOutwardPage() {
  const { can, user, isAdmin } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const adminUser = isAdmin();
  const canCompleteRequest =
    can('asset-requests:approve') || can('movements:approve') || can('*');
  const [mode, setMode] = useState('manual'); // manual | requests | pods
  const [rows, setRows] = useState([]);
  const [podRows, setPodRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyTxnForm(user, { entryType: 'Outward' }));
  const [busy, setBusy] = useState(false);
  const [fulfillingId, setFulfillingId] = useState('');
  const [fulfillingLineId, setFulfillingLineId] = useState('');
  const [fulfillingLineIndex, setFulfillingLineIndex] = useState(null);
  const [dispatchedLines, setDispatchedLines] = useState(() => new Set());
  const [statusFilter, setStatusFilter] = useState('Open');
  const [deliveryBusyId, setDeliveryBusyId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [podDateFrom, setPodDateFrom] = useState(() => todayLocalDate());
  const [podDateTo, setPodDateTo] = useState(() => todayLocalDate());
  const [podPage, setPodPage] = useState(1);
  const [podLimit, setPodLimit] = useState(25);
  const [podListMeta, setPodListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [podLoading, setPodLoading] = useState(false);
  const [podExportBusy, setPodExportBusy] = useState(false);
  /** Selected POD row ids for bulk Delivered / Delete / Excel */
  const [podSelectedIds, setPodSelectedIds] = useState(() => new Set());
  const [podBulkBusy, setPodBulkBusy] = useState(false);
  /** Available inward lots keyed by productId → [{ batchNumber, expiryDate, serialNumber, qty }] */
  const [stockLotsByProductId, setStockLotsByProductId] = useState({});

  const cfg = meta?.inOut || {};
  const productTypes = cfg.productTypes || FALLBACK_PRODUCT;
  const issueKinds = cfg.goodsIssueKinds || GOODS_ISSUE_KINDS;
  const showFrom = needsFromContact(form.logisticsKind);
  const showTo = needsToContact(form.logisticsKind);
  const issueKind = normalizeIssueKind(form.logisticsKind);
  const prepareFixedOrigin = issueKind === 'Fresh Dispatch';
  const prepareFixedDestination = issueKind === 'Recall / Pickup';
  const prepareShowSender =
    issueKind === 'Inter Transfer' || issueKind === 'Recall / Pickup';
  const prepareShowRecipient =
    issueKind === 'Fresh Dispatch' ||
    issueKind === 'Inter Transfer' ||
    prepareFixedDestination;
  const categoryDefaults = cfg.categoryDefaults || FALLBACK_CAT_DEFAULTS;
  const warehouses = meta?.warehouses || [];
  const products = meta?.products || [];
  const uoms = meta?.uoms || [];
  const defaultWarehouseName = cfg.defaultWarehouseName || 'Mumbai';

  const uomLabel = useCallback(
    (uomId) => {
      if (!uomId) return '';
      const u = uoms.find((x) => String(x._id) === String(uomId));
      if (!u) return '';
      return u.code ? `${u.name} (${u.code})` : u.name || '';
    },
    [uoms]
  );

  const defaultWarehouseId = useMemo(() => {
    const hit =
      warehouses.find((w) => w.name === defaultWarehouseName) ||
      warehouses.find((w) => String(w.code || '').toUpperCase() === 'WH-MUM') ||
      warehouses.find((w) => /mumbai/i.test(w.name || '') || /mumbai/i.test(w.city || '')) ||
      warehouses[0];
    return hit?._id || '';
  }, [warehouses, defaultWarehouseName]);

  const productsForType = useMemo(
    () =>
      products.filter(
        (p) => !form.productType || resolveProductType(p.productType) === form.productType
      ),
    [products, form.productType]
  );

  const packageVolumetricKg = useMemo(
    () => volumetricWeightKg(form.packageLength, form.packageHeight, form.packageWidth),
    [form.packageLength, form.packageHeight, form.packageWidth],
  );
  const packageApplicableKg = useMemo(
    () => applicableWeightKg(
      form.packageWeight,
      form.packageLength,
      form.packageHeight,
      form.packageWidth,
    ),
    [form.packageWeight, form.packageLength, form.packageHeight, form.packageWidth],
  );

  const prepareIsCourier =
    mapDeliveryMode(form.deliveryMode) === 'Courier' && form.packageStatus !== 'No stock';

  const preparePodDest = useMemo(
    () => ({
      city: form.toCity || form.city || '',
      state: form.toState || form.state || '',
    }),
    [form.toCity, form.city, form.toState, form.state]
  );

  const prepareBillableKg = useMemo(() => {
    if (packageApplicableKg != null && packageApplicableKg > 0) return packageApplicableKg;
    const w = Number(form.packageWeight);
    return Number.isFinite(w) && w > 0 ? w : null;
  }, [packageApplicableKg, form.packageWeight]);

  const courierQuoteOptions = useMemo(() => {
    if (!formOpen || !prepareIsCourier || prepareBillableKg == null) return [];
    return quoteCourierRateCard(prepareBillableKg, preparePodDest);
  }, [formOpen, prepareIsCourier, prepareBillableKg, preparePodDest]);

  useEffect(() => {
    if (!prepareIsCourier || !courierQuoteOptions.length) return;
    const cheapest = courierQuoteOptions.find((o) => o.isCheapest);
    const stillValid = courierQuoteOptions.some((o) => o.id === String(form.podCourierId || ''));
    if (!stillValid && cheapest) {
      setForm((prev) => ({ ...prev, podCourierId: cheapest.id }));
    }
  }, [prepareIsCourier, courierQuoteOptions, form.podCourierId]);

  const fulfillLots = useMemo(
    () => stockLotsByProductId[String(form.productId || '')] || [],
    [stockLotsByProductId, form.productId]
  );
  const fulfillBatchOpts = useMemo(
    () => batchOptionsFromLots(fulfillLots, form.expiryDate || ''),
    [fulfillLots, form.expiryDate]
  );
  const fulfillExpiryOpts = useMemo(
    () => expiryOptionsFromLots(fulfillLots, form.batchNumber || ''),
    [fulfillLots, form.batchNumber]
  );
  const fulfillSerialOpts = useMemo(
    () =>
      serialOptionsFromLots(
        fulfillLots,
        form.batchNumber || '',
        form.expiryDate || ''
      ),
    [fulfillLots, form.batchNumber, form.expiryDate]
  );

  const loadRows = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        entryTypes: 'Outward,Return',
        excludePodBooked: '1',
      });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (statusFilter && statusFilter !== 'All') params.set('dispatchStatus', statusFilter);
      const res = await api(`/logistics/in-out?${params}`);
      const list = (res.data || []).filter(
        (r) => r.entryType !== 'Return' || Boolean(r.logisticsKind)
      );
      setRows(list);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [debouncedQ, statusFilter, page, limit]);

  const loadPods = useCallback(async () => {
    setPodLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(podPage),
        limit: String(podLimit),
        dateFrom: podDateFrom || '',
        dateTo: podDateTo || '',
      });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      const res = await api(`/logistics/in-out/pods?${params}`);
      setPodRows(res.data || []);
      setPodListMeta(res.meta || { page: podPage, limit: podLimit, total: 0, pages: 0 });
      setPodSelectedIds(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setPodLoading(false);
    }
  }, [debouncedQ, podDateFrom, podDateTo, podPage, podLimit]);

  const podOpenSelected = useMemo(
    () => podRows.filter((r) => podSelectedIds.has(String(r._id)) && isDispatchOpen(r)),
    [podRows, podSelectedIds]
  );

  const podAllSelected =
    podRows.length > 0 && podRows.every((r) => podSelectedIds.has(String(r._id)));

  const togglePodSelect = (id) => {
    const key = String(id);
    setPodSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePodSelectAll = () => {
    if (podAllSelected) {
      setPodSelectedIds(new Set());
      return;
    }
    setPodSelectedIds(new Set(podRows.map((r) => String(r._id))));
  };

  const clearPodSelection = () => setPodSelectedIds(new Set());

  const downloadPodsExcel = async () => {
    setPodExportBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      const selectedIds = [...podSelectedIds]
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== 'undefined' && id !== 'null');
      const selectedRows = podRows.filter((row) =>
        selectedIds.some((id) => String(row._id) === id)
      );
      if (selectedIds.length) {
        // Selected TXNs only — send both Mongo/file ids and TXN numbers.
        params.set('ids', selectedIds.join(','));
        const keys = selectedRows
          .map((row) => String(row.uniqueKey || '').trim())
          .filter(Boolean);
        if (keys.length) params.set('uniqueKeys', keys.join(','));
      } else {
        params.set('dateFrom', podDateFrom || '');
        params.set('dateTo', podDateTo || '');
        if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      }
      const label = selectedIds.length
        ? `selected_${selectedIds.length}`
        : podDateFrom && podDateTo && podDateFrom === podDateTo
          ? podDateFrom
          : `${podDateFrom || 'start'}_to_${podDateTo || 'end'}`;
      await downloadExcel(`/logistics/in-out/pods/export?${params.toString()}`, `PODs_${label}.xlsx`);
      setMsg(
        selectedIds.length
          ? `POD Excel downloaded (${selectedIds.length} selected).`
          : 'POD Excel downloaded.'
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setPodExportBusy(false);
    }
  };

  const markPodsBulk = async (outcome) => {
    if (!canWrite || !podOpenSelected.length) return;
    const label = outcome === 'RTO' ? 'RTO' : 'Delivered';
    if (
      !window.confirm(
        `Mark ${podOpenSelected.length} selected POD${podOpenSelected.length === 1 ? '' : 's'} as ${label}? They will close automatically.`
      )
    ) {
      return;
    }
    setPodBulkBusy(true);
    setError('');
    setMsg('');
    let ok = 0;
    let fail = 0;
    try {
      for (const row of podOpenSelected) {
        try {
          await api(`/logistics/in-out/${row._id}/delivery`, {
            method: 'PATCH',
            body: { outcome },
          });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      setMsg(
        fail
          ? `${ok} marked ${label}; ${fail} failed.`
          : `${ok} POD${ok === 1 ? '' : 's'} marked ${label} and closed.`
      );
      clearPodSelection();
      await loadPods();
      await loadRows();
    } catch (e) {
      setError(e.message);
    } finally {
      setPodBulkBusy(false);
    }
  };

  const deletePodsBulk = async () => {
    if (!adminUser || !podSelectedIds.size) return;
    const selected = podRows.filter((r) => podSelectedIds.has(String(r._id)));
    if (!selected.length) return;
    if (
      !window.confirm(
        `Permanently delete ${selected.length} selected POD${selected.length === 1 ? '' : 's'}? This cannot be undone.`
      )
    ) {
      return;
    }
    setPodBulkBusy(true);
    setError('');
    setMsg('');
    let ok = 0;
    let fail = 0;
    try {
      for (const row of selected) {
        try {
          await api(`/logistics/in-out/${row._id}`, { method: 'DELETE' });
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      setMsg(
        fail
          ? `${ok} deleted; ${fail} failed.`
          : `${ok} POD${ok === 1 ? '' : 's'} deleted.`
      );
      clearPodSelection();
      await loadPods();
      await loadRows();
    } catch (e) {
      setError(e.message);
    } finally {
      setPodBulkBusy(false);
    }
  };

  const bookPodForEntry = async (entryId, { weightKg, courierId, awbNumber, note, serviceType, productType }) => {
    const selected = courierQuoteOptions.find((o) => o.id === String(courierId))
      || quoteCourierRateCard(weightKg, preparePodDest).find((o) => o.id === String(courierId));
    const resolvedService = mapPodServiceType(serviceType || selected?.name || '');
    const resolvedCourierType = mapPodCourierType(productType);
    await api(`/logistics/in-out/${entryId}/delivery`, {
      method: 'PATCH',
      body: {
        outcome: 'POD Booked',
        awbNumber: String(awbNumber || '').trim(),
        transporterId: String(courierId || '').startsWith('ratecard-') ? null : courierId || null,
        applicableWeight: formatWeightKg(weightKg),
        packageWeight: formatWeightKg(weightKg),
        serviceType: resolvedService,
        courierType: resolvedCourierType,
        remark: selected
          ? `${selected.name} · ${selected.categoryLabel || selected.zoneLabel || ''} · est. ₹${selected.estimate ?? '—'}${note ? ` · ${note}` : ''}`
          : note || '',
      },
    });
    return selected;
  };

  const markDelivery = async (row, outcome) => {
    if (!canWrite || !row?._id) return;
    if (outcome === 'Closed') return;
    const label = outcome === 'RTO' ? 'RTO' : outcome === 'POD Booked' ? 'POD Booked' : 'Delivered';
    const leavesOpen = outcome === 'POD Booked';
    if (
      !window.confirm(
        leavesOpen
          ? `Mark this goods issue as ${label}?`
          : `Mark this goods issue as ${label}? It will close automatically.`
      )
    ) {
      return;
    }
    setDeliveryBusyId(row._id);
    setError('');
    setMsg('');
    try {
      await api(`/logistics/in-out/${row._id}/delivery`, {
        method: 'PATCH',
        body: { outcome },
      });
      setMsg(
        leavesOpen
          ? `Goods issue marked ${label}.`
          : `Goods issue marked ${label} and closed.`
      );
      await loadRows();
      if (mode === 'pods') await loadPods();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeliveryBusyId('');
    }
  };

  const loadRequests = useCallback(async () => {
    try {
      const res = await api('/asset-requests?requestType=LOGISTICS&limit=100');
      const list = (res.data || []).filter((r) => String(r.status || '') === 'APPROVED');
      setRequests(list);
    } catch {
      setRequests([]);
    }
  }, []);

  const filteredRequests = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((r) => {
      const progress = fulfillmentProgress(r);
      const hay = [
        r.requestNumber,
        r.status,
        r.logisticsKind,
        r.assetName,
        r.toCity,
        r.toName,
        r.toContactId?.city,
        r.toContactId?.name,
        r.requestorId?.fullName,
        r.requestorId?.email,
        r.transportMode,
        ...(progress.lines || []).flatMap((line) => [
          line.productName,
          line.productType,
          line.qty,
        ]),
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return hay.includes(term);
    });
  }, [requests, debouncedQ]);

  useEffect(() => {
    api('/logistics/meta')
      .then((r) => setMeta(r.data))
      .catch(() => {});
    fetchContactsList({ limit: 200 })
      .then((rows) => setContacts(rows))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (mode === 'requests') loadRequests();
  }, [mode, loadRequests]);

  useEffect(() => {
    if (mode === 'pods') loadPods();
  }, [mode, loadPods]);

  const stockProductIdsKey = useMemo(() => {
    const ids = new Set();
    if (form.productId) ids.add(String(form.productId));
    for (const row of form.logisticsProducts || []) {
      if (row.productId) ids.add(String(row.productId));
    }
    return [...ids].sort().join(',');
  }, [form.productId, form.logisticsProducts]);

  const stockProductNameById = useMemo(() => {
    const map = {};
    if (form.productId) {
      map[String(form.productId)] = form.productName || '';
    }
    for (const row of form.logisticsProducts || []) {
      if (row.productId) {
        map[String(row.productId)] = row.productName || map[String(row.productId)] || '';
      }
    }
    return map;
  }, [form.productId, form.productName, form.logisticsProducts]);

  useEffect(() => {
    if (!formOpen || !stockProductIdsKey) {
      setStockLotsByProductId({});
      return undefined;
    }
    let cancelled = false;
    const ids = stockProductIdsKey.split(',').filter(Boolean);
    const warehouseId = form.warehouseId || defaultWarehouseId || '';
    (async () => {
      const next = {};
      await Promise.all(
        ids.map(async (productId) => {
          const params = new URLSearchParams({ productId });
          const productName = stockProductNameById[productId] || '';
          if (productName) params.set('productName', productName);
          if (warehouseId) params.set('warehouseId', warehouseId);
          try {
            const res = await api(`/logistics/inventory/lots?${params}`);
            next[productId] = normalizeStockLots(res.data || []);
          } catch {
            // Fallback to raw inventory rows if lots endpoint is unavailable
            try {
              const fallback = new URLSearchParams({
                productId,
                status: 'Available',
                limit: '500',
              });
              if (warehouseId) fallback.set('warehouseId', warehouseId);
              const res = await api(`/logistics/inventory?${fallback}`);
              next[productId] = normalizeStockLots(res.data || []);
            } catch {
              next[productId] = [];
            }
          }
        })
      );
      if (!cancelled) setStockLotsByProductId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    formOpen,
    stockProductIdsKey,
    stockProductNameById,
    form.warehouseId,
    defaultWarehouseId,
  ]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pickBatchFromLots = (lots, batchNumber, currentExpiry = '') => {
    const batch = String(batchNumber || '').trim();
    const expiries = expiryOptionsFromLots(lots, batch).map((o) => o.value);
    let expiryDate = String(currentExpiry || '').slice(0, 10);
    if (batch && expiries.length === 1) {
      expiryDate = expiries[0];
    } else if (expiryDate && expiries.length && !expiries.includes(expiryDate)) {
      expiryDate = '';
    }
    return { batchNumber: batch, expiryDate };
  };

  const pickExpiryFromLots = (lots, expiryDate, currentBatch = '') => {
    const expiry = String(expiryDate || '').slice(0, 10);
    const batches = batchOptionsFromLots(lots, expiry).map((o) => o.value);
    let batchNumber = String(currentBatch || '').trim();
    if (expiry && batches.length === 1) {
      batchNumber = batches[0];
    } else if (batchNumber && batches.length && !batches.includes(batchNumber)) {
      batchNumber = '';
    }
    return { batchNumber, expiryDate: expiry };
  };

  const productLabel = productOptionLabel;

  const productDisplayName = productAssetName;

  const openManual = () => {
    const base = emptyTxnForm(user, {
      entryType: 'Outward',
      warehouseId: defaultWarehouseId,
    });
    base.logisticsKind = 'Fresh Dispatch';
    base.priority = 'Medium';
    base.deliveryMode = 'Hand Delivery';
    base.logisticsProducts = [emptyIssueProduct()];
    base.logisticsProductsConfirmed = false;
    setFulfillingId('');
    setFulfillingLineId('');
    setFulfillingLineIndex(null);
    setForm(base);
    setFormOpen(true);
    setMode('manual');
    setMsg('');
    setError('');
  };

  const openFromRequest = (req, line, lineIndex) => {
    const base = emptyTxnForm(user, {
      entryType: 'Outward',
      warehouseId: defaultWarehouseId,
    });
    const kind = normalizeIssueKind(req.logisticsKind);
    const requestedType = line?.productType || base.productType;
    const defaults = categoryDefaults[requestedType] || FALLBACK_CAT_DEFAULTS[requestedType] || {};
    base.expiryApplicable = !!defaults?.expiryApplicable;
    base.trackingKind = defaults?.trackingKind || 'Batch';
    base.batchOrSerial = base.trackingKind === 'None' ? 'N/A' : '';
    base.logisticsKind = kind;
    if (kind === 'Fresh Dispatch') {
      Object.assign(base, fixedPodPartyFields('from'));
      Object.assign(base, syncRecipientAliases(partyFromRequest(req, 'to')));
    } else if (kind === 'Recall / Pickup') {
      Object.assign(base, partyFromRequest(req, 'from'));
      Object.assign(base, syncRecipientAliases(fixedPodPartyFields('to')));
    } else {
      // Inter Transfer — both ends from Request One
      Object.assign(base, partyFromRequest(req, 'from'));
      Object.assign(base, syncRecipientAliases(partyFromRequest(req, 'to')));
    }
    base.productType = requestedType;
    base.productId = refId(line?.productId);
    base.productName = line?.productName || line?.productId?.name || '';
    base.qty = String(line?.qty || 1);
    base.uomId = refId(line?.uomId) || '';
    base.deliveryMode = mapDeliveryMode(req.transportMode);
    base.priority = mapRequestPriority(req.priority);
    base.packageStatus = '';
    base.packageNote = '';
    base.packageWeight = '';
    base.packageLength = '';
    base.packageHeight = '';
    base.packageWidth = '';
    base.declaredPrice = '';
    base.numberOfPieces = '1';
    base.toAddressLine2 = '';
    base.riskSurcharge = 'NO';
    base.awbNumber = '';
    base.podCourierId = '';
    base.requestRemarks = (() => {
      const clientBits = [req.clientName || req.clientCode, req.divisionTherapy, req.hiringMethod]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      const reason = String(req.reason || '').trim();
      const clientLabel = clientBits.length ? `Client: ${clientBits.join(' · ')}` : '';
      return [clientLabel, reason].filter(Boolean).join(' — ');
    })();
    base.remark = String(req.reason || '').trim();
    base.assetRequestId = req._id;
    base.assetRequestLineId = lineId(line);
    base.assetRequestLineIndex = lineIndex;
    const match =
      products.find((product) => String(product._id) === refId(line?.productId)) ||
      products.find(
        (product) =>
          String(product.name || '').toLowerCase() ===
          String(line?.productName || '').toLowerCase()
      );
    if (match) {
      base.productId = match._id;
      base.productName = productDisplayName(match) || match.name;
      base.productType = match.productType || base.productType;
      if (!base.uomId && match.uomId) base.uomId = String(match.uomId);
      const meta = lineTrackingMeta(base.productType, match, categoryDefaults);
      base.trackingKind = meta.trackingKind;
      base.expiryApplicable = meta.expiryApplicable;
      base.serialNumber = '';
      base.batchNumber = '';
      base.expiryDate = '';
    } else {
      const meta = lineTrackingMeta(requestedType, null, categoryDefaults);
      base.trackingKind = meta.trackingKind;
      base.expiryApplicable = meta.expiryApplicable;
      base.serialNumber = '';
      base.batchNumber = '';
      base.expiryDate = '';
    }
    base.contentType = buildPodContentType(base.productType, base.productName);
    setFulfillingId(req._id);
    setFulfillingLineId(lineId(line));
    setFulfillingLineIndex(lineIndex);
    setForm(base);
    setFormOpen(true);
    setMode('manual');
    setMsg('');
    setError('');
  };

  const onIssueKindChange = (next) => {
    const kind = normalizeIssueKind(next);
    setForm((f) => ({
      ...f,
      logisticsKind: kind,
      ...(kind === 'Fresh Dispatch'
        ? fixedPodPartyFields('from')
        : emptyContactPrefix('from')),
      ...(kind === 'Recall / Pickup'
        ? syncRecipientAliases(fixedPodPartyFields('to'))
        : {
      ...emptyContactPrefix('to'),
      contactId: '',
      recipientName: '',
      empId: '',
      number: '',
      city: '',
      state: '',
          }),
      logisticsProductsConfirmed: false,
    }));
  };

  const updateIssueProduct = (index, changes) => {
    setForm((f) => ({
      ...f,
      logisticsProductsConfirmed: false,
      logisticsProducts: (f.logisticsProducts || []).map((item, i) =>
        i === index ? { ...item, ...changes } : item
      ),
    }));
  };

  const selectIssueProduct = (index, productId) => {
    const duplicate = (form.logisticsProducts || []).some(
      (item, i) => i !== index && productId && String(item.productId) === String(productId)
    );
    if (duplicate) {
      setError('The same product cannot be added more than once.');
      return;
    }
    setError('');
    const product = products.find((item) => String(item._id) === String(productId));
    if (!product) {
      updateIssueProduct(index, { productId: '', productName: '' });
      return;
    }
    const type =
      product.productType || form.logisticsProducts[index]?.productType || '';
    const meta = lineTrackingMeta(type, product, categoryDefaults);
    updateIssueProduct(index, {
      productId: String(product._id),
      productName: productDisplayName(product),
      productType: type,
      trackingKind: meta.trackingKind,
      expiryApplicable: meta.expiryApplicable,
      serialNumber: '',
      batchNumber: '',
      expiryDate: '',
    });
  };

  const addIssueProduct = () => {
    setForm((f) => ({
      ...f,
      logisticsProductsConfirmed: false,
      logisticsProducts: [...(f.logisticsProducts || []), emptyIssueProduct()],
    }));
  };

  const removeIssueProduct = (index) => {
    setForm((f) => ({
      ...f,
      logisticsProductsConfirmed: false,
      logisticsProducts:
        (f.logisticsProducts || []).length <= 1
          ? [emptyIssueProduct()]
          : (f.logisticsProducts || []).filter((_, i) => i !== index),
    }));
  };

  const confirmIssueProducts = () => {
    const list = form.logisticsProducts || [];
    const invalid = list.some(
      (item) => !item.productType || !item.productId || !(Number(item.qty) > 0)
    );
    if (invalid) {
      setError('Each product needs category, model/variant/name, and qty.');
      return;
    }
    const ids = list.map((item) => String(item.productId));
    if (new Set(ids).size !== ids.length) {
      setError('The same product cannot be added more than once.');
      return;
    }
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      const product = products.find((p) => String(p._id) === String(item.productId));
      const meta = lineTrackingMeta(item.productType, product, categoryDefaults);
      if (lineNeedsSerial(meta.trackingKind) && !String(item.serialNumber || '').trim()) {
        setError(
          `Serial number is required for ${item.productName || item.productType || `product ${i + 1}`} (${meta.trackingKind}).`
        );
        return;
      }
      if (lineNeedsBatch(meta.trackingKind) && !String(item.batchNumber || '').trim()) {
        setError(
          `Batch number is required for ${item.productName || item.productType || `product ${i + 1}`} (${meta.trackingKind}).`
        );
        return;
      }
      if (meta.expiryApplicable && !String(item.expiryDate || '').trim()) {
        setError(
          `Expiry date is required for ${item.productName || item.productType || `product ${i + 1}`}.`
        );
        return;
      }
    }
    setError('');
    setForm((f) => ({
      ...f,
      logisticsProductsConfirmed: true,
      logisticsProducts: (f.logisticsProducts || []).map((item) => {
        const product = products.find((p) => String(p._id) === String(item.productId));
        const meta = lineTrackingMeta(item.productType, product, categoryDefaults);
        return {
          ...item,
          trackingKind: meta.trackingKind,
          expiryApplicable: meta.expiryApplicable,
        };
      }),
    }));
  };

  const onProductCategoryChange = (next) => {
    const defaults = categoryDefaults[next] || FALLBACK_CAT_DEFAULTS[next] || {};
    setForm((f) => ({
      ...f,
      productType: next,
      productId: '',
      productName: '',
      programProject: '',
      expiryApplicable: !!defaults.expiryApplicable,
      trackingKind: defaults.trackingKind || 'None',
      expiryDate: defaults.expiryApplicable ? f.expiryDate : '',
      batchOrSerial: defaults.trackingKind === 'None' ? 'N/A' : '',
    }));
  };

  const pickProduct = (productId) => {
    const p = products.find((x) => x._id === productId);
    if (!p) {
      setForm((f) => ({ ...f, productId: '', productName: '', programProject: '' }));
      return;
    }
    const defaults =
      categoryDefaults[p.productType || form.productType] ||
      FALLBACK_CAT_DEFAULTS[p.productType || form.productType] ||
      {};
    const expiryApplicable =
      p.expiryApplicable != null ? !!p.expiryApplicable : !!defaults.expiryApplicable;
    const trackingKind = p.trackingKind || defaults.trackingKind || 'None';
    setForm((f) => ({
      ...f,
      productId: p._id,
      productName: productDisplayName(p),
      programProject: p.programProject || '',
      productType: p.productType || f.productType,
      expiryApplicable,
      trackingKind,
      batchOrSerial: trackingKind === 'None' ? 'N/A' : f.batchOrSerial === 'N/A' ? '' : f.batchOrSerial,
      expiryDate: expiryApplicable ? f.expiryDate : '',
      perUnitCost: p.defaultPerUnitCost != null ? String(p.defaultPerUnitCost) : f.perUnitCost,
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const kind = normalizeIssueKind(form.logisticsKind);
    if (!kind || !GOODS_ISSUE_KINDS.includes(kind)) {
      setError('Select an Issue kind.');
      return;
    }
    const isNoStock = fulfillingId && form.packageStatus === 'No stock';
    if (!isNoStock && !form.deliveryMode) {
      setError('Select Delivery mode.');
      return;
    }
    if (fulfillingId) {
      if (!PACKAGE_STATUSES.includes(String(form.packageStatus || '').trim())) {
        setError('Confirm package status: Package ready, Partially ready, or No stock.');
      return;
    }
      if (
        form.packageStatus === 'Partially ready'
        && (!(Number(form.qty) > 0))
      ) {
        setError('Enter the packed quantity for Partially ready.');
      return;
    }
    }
    if (!ISSUE_PRIORITIES.includes(String(form.priority || '').trim())) {
      setError('Select priority (High, Medium, or Low).');
      return;
    }
    const wantsPod =
      Boolean(fulfillingId) &&
      !isNoStock &&
      mapDeliveryMode(form.deliveryMode) === 'Courier';
    if (wantsPod) {
      if (!(prepareBillableKg > 0)) {
        setError('Enter package weight (and dimensions if needed) so billable weight can be calculated.');
        return;
      }
      if (!(Number(form.packageLength) > 0) || !(Number(form.packageWidth) > 0) || !(Number(form.packageHeight) > 0)) {
        setError('Enter Length, Width and Height (cm) for the courier booking.');
        return;
      }
      if (!String(form.declaredPrice || '').trim()) {
        setError('Enter Declared Price for the shipment.');
        return;
      }
      if (!String(form.fromPinCode || '').trim() || !String(form.fromName || '').trim() || !String(form.fromNumber || '').trim() || !String(form.fromAddress || '').trim()) {
        setError('Complete Origin name, phone, address and pincode.');
        return;
      }
      if (!String(form.toPinCode || '').trim() || !String(form.toName || '').trim() || !String(form.toNumber || '').trim() || !String(form.toAddress || '').trim()) {
        setError('Complete Destination name, phone, address line 1 and pincode.');
        return;
      }
      if (!String(form.podCourierId || '').trim()) {
        setError('Select a courier (plane / truck icon).');
        return;
      }
      if (!String(form.awbNumber || '').trim()) {
        setError('Enter the AWB number to book POD with this package.');
        return;
      }
    }
    if (!isNoStock && needsFromContact(kind) && !form.fromContactId) {
      // Recall / Inter Transfer: sender must come from Contact Directory (Request One)
      if (!(String(form.fromName || '').trim() && String(form.fromAddress || '').trim())) {
        setError('Select Sender / Pickup from Contact Directory.');
        return;
      }
    }
    if (!isNoStock && needsToContact(kind) && !(form.toContactId || form.contactId)) {
      // Fresh Dispatch / Inter Transfer need a recipient contact; Recall uses fixed HQ destination.
      if (kind === 'Recall / Pickup') {
        if (!(String(form.toName || '').trim() && String(form.toAddress || '').trim())) {
          setError('Complete the fixed Destination (Tylo Care HQ).');
          return;
        }
      } else if (!(String(form.toName || '').trim() && String(form.toAddress || '').trim())) {
      setError('Select Send to / Recipient from Contact Directory.');
      return;
      }
    }

    const isManualMulti = !fulfillingId;
    let lines = [];
    if (isManualMulti) {
      if (!form.logisticsProductsConfirmed) {
        setError('Confirm products before saving.');
        return;
      }
      lines = (form.logisticsProducts || []).filter(
        (item) => item.productId && Number(item.qty) > 0
      );
      if (!lines.length) {
        setError('Add at least one product.');
        return;
      }
    } else {
      lines = [
        {
          productType: form.productType,
          productId: form.productId,
          productName: form.productName,
          qty: form.qty,
          uomId: form.uomId || '',
          trackingKind: form.trackingKind,
          expiryApplicable: form.expiryApplicable,
          serialNumber: form.serialNumber || '',
          batchNumber: form.batchNumber || '',
          expiryDate: form.expiryDate || '',
        },
      ];
    }

    setBusy(true);
    setError('');
    setMsg('');
    const dispatchKey =
      fulfillingId && fulfillingLineIndex != null
        ? `${fulfillingId}:${fulfillingLineId || fulfillingLineIndex}`
        : '';
    if (dispatchKey && dispatchedLines.has(dispatchKey)) {
      setBusy(false);
      setError('This request product line was already prepared. Refresh the request list.');
      return;
    }
    try {
      const entryType = entryTypeForKind(kind);
      const txnDate = todayLocalDate();
      const txnAt = `${txnDate}T${String(nowLocal()).slice(11, 16)}`;
      let lastResult = null;

      if (isNoStock) {
        lastResult = await api('/logistics/in-out', {
          method: 'POST',
          body: {
            uniqueKey:
              (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID())
              || `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            entryType: 'Outward',
            logisticsKind: kind,
            priority: form.priority || 'Medium',
            packageStatus: 'No stock',
            packageNote: form.packageNote || '',
            packageWeight: form.packageWeight || '',
            packageLength: form.packageLength || '',
            packageHeight: form.packageHeight || '',
            packageWidth: form.packageWidth || '',
            volumetricWeight: formatWeightKg(packageVolumetricKg),
            applicableWeight: formatWeightKg(packageApplicableKg),
            assetRequestId: fulfillingId,
            assetRequestLineId: fulfillingLineId || null,
            assetRequestLineIndex: fulfillingLineIndex,
            productId: form.productId || null,
            productName: form.productName || '',
            productType: form.productType || '',
            qty: Number(form.qty) || 0,
            remark: form.remark || 'No stock',
          },
        });
      } else for (const line of lines) {
        const product = products.find((p) => String(p._id) === String(line.productId));
        const meta = lineTrackingMeta(
          line.productType || product?.productType,
          product,
          categoryDefaults
        );
        const trackingKind = line.trackingKind || meta.trackingKind;
        const expiryApplicable =
          line.expiryApplicable != null ? !!line.expiryApplicable : meta.expiryApplicable;
        const serialNumber = String(line.serialNumber || form.serialNumber || '').trim();
        const batchNumber = String(line.batchNumber || form.batchNumber || '').trim();
        const expiryDate = String(line.expiryDate || form.expiryDate || '').trim();
        const batchOrSerial =
          lineBatchOrSerial({ ...line, trackingKind, serialNumber, batchNumber }) ||
          (trackingKind === 'None' ? 'N/A' : '');

        if (lineNeedsSerial(trackingKind) && !serialNumber) {
          throw new Error(
            `Serial number is required for ${line.productName || line.productType || 'device'}.`
          );
        }
        if (lineNeedsBatch(trackingKind) && !batchNumber) {
          throw new Error(
            `Batch number is required for ${line.productName || line.productType || 'product'}.`
          );
        }
        if (expiryApplicable && !expiryDate) {
          throw new Error(
            `Expiry date is required for ${line.productName || line.productType || 'product'}.`
          );
        }

        const qty = Number(line.qty) || 0;
        const availParams = new URLSearchParams();
        if (line.productId) availParams.set('productId', line.productId);
        if (form.warehouseId || defaultWarehouseId) {
          availParams.set('warehouseId', form.warehouseId || defaultWarehouseId);
        }
        if (serialNumber) availParams.set('serialNumber', serialNumber);
        if (batchNumber) availParams.set('batchNumber', batchNumber);
        if (expiryDate) availParams.set('expiryDate', expiryDate);
        if (line.productName || product?.name) {
          availParams.set('productName', line.productName || productDisplayName(product) || '');
        }
        const availRes = await api(`/logistics/inventory/availability?${availParams}`);
        const availableQty = Number(availRes.data?.availableQty) || 0;
        if (qty > availableQty) {
          throw new Error(
            `Insufficient available stock for “${line.productName || line.productType || 'product'}” (available ${availableQty}, requested ${qty})`
          );
        }

        lastResult = await api('/logistics/in-out', {
          method: 'POST',
          body: {
            uniqueKey:
              (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID())
              || `out-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            entryType,
            logisticsKind: kind,
            priority: form.priority || 'Medium',
            packageStatus: fulfillingId ? form.packageStatus || '' : '',
            packageNote: fulfillingId ? form.packageNote || '' : '',
            packageWeight: fulfillingId ? form.packageWeight || '' : '',
            packageLength: fulfillingId ? form.packageLength || '' : '',
            packageHeight: fulfillingId ? form.packageHeight || '' : '',
            packageWidth: fulfillingId ? form.packageWidth || '' : '',
            volumetricWeight: fulfillingId ? formatWeightKg(packageVolumetricKg) : '',
            applicableWeight: fulfillingId ? formatWeightKg(packageApplicableKg) : '',
            declaredPrice: fulfillingId ? form.declaredPrice || '' : '',
            numberOfPieces: fulfillingId ? '1' : '',
            toAddressLine2: fulfillingId ? form.toAddressLine2 || '' : '',
            riskSurcharge: 'NO',
            contentType: fulfillingId
              ? form.contentType || buildPodContentType(form.productType, form.productName)
              : '',
            serviceType: wantsPod
              ? mapPodServiceType(
                  courierQuoteOptions.find((o) => o.id === String(form.podCourierId))?.name || ''
                )
              : '',
            courierType: wantsPod
              ? mapPodCourierType(line.productType || product?.productType || form.productType)
              : '',
            deliveryMode: mapDeliveryMode(form.deliveryMode),
            warehouseId: form.warehouseId || defaultWarehouseId || null,
            sourceWarehouseId: form.warehouseId || defaultWarehouseId || null,
            contactId: form.toContactId || form.contactId || null,
            fromContactId: form.fromContactId || null,
            fromName: form.fromName || FIXED_POD_ORIGIN.fromName,
            fromNumber: form.fromNumber || FIXED_POD_ORIGIN.fromNumber,
            fromAddress: form.fromAddress || FIXED_POD_ORIGIN.fromAddress,
            fromPinCode: form.fromPinCode || FIXED_POD_ORIGIN.fromPinCode,
            fromCity: form.fromCity || 'Mumbai',
            fromState: form.fromState || 'Maharashtra',
            productId: line.productId || null,
            productType: line.productType || product?.productType || '',
            productName: line.productName || productDisplayName(product) || '',
            assetRequestId: fulfillingId || form.assetRequestId || null,
            assetRequestLineId: fulfillingId ? fulfillingLineId || null : null,
            assetRequestLineIndex: fulfillingId ? fulfillingLineIndex : null,
            employeeName: form.toName || form.recipientName,
            name: form.toName || form.recipientName,
            recipientName: form.toName || form.recipientName,
            city: form.toCity || form.city || '',
            state: form.toState || form.state || '',
            number: form.toNumber || form.number || '',
            address: form.toAddress || '',
            toAddress: form.toAddress || '',
            pinCode: form.toPinCode || '',
            toPinCode: form.toPinCode || '',
            qty: Number(line.qty) || 0,
            uomId: line.uomId || form.uomId || product?.uomId || null,
            perUnitCost: Number(product?.defaultPerUnitCost || form.perUnitCost) || 0,
            trackingKind,
            batchOrSerial,
            serialNumber,
            batchNumber,
            expiryApplicable,
            expiryDate: expiryApplicable ? expiryDate : '',
            transactionDateTime: txnAt,
            transactionDate: txnDate,
            awbNumber: wantsPod ? String(form.awbNumber || '').trim() : '',
            remark: form.remark || kind,
          },
        });
        const createdId = lastResult?.data?._id;
        if (wantsPod && createdId) {
          const selected = courierQuoteOptions.find((o) => o.id === String(form.podCourierId));
          await bookPodForEntry(createdId, {
            weightKg: prepareBillableKg,
            courierId: form.podCourierId,
            awbNumber: form.awbNumber,
            note: form.packageNote || '',
            serviceType: selected?.name || '',
            productType: line.productType || product?.productType || form.productType,
          });
        }
      }

      const dispatchResult = lastResult;

      if (fulfillingId) {
        if (dispatchKey) {
          setDispatchedLines((previous) => new Set(previous).add(dispatchKey));
        }
        const confirmedFulfillment = dispatchResult?.fulfillment;
        let progress = confirmedFulfillment
          ? {
              fulfilled: Number(confirmedFulfillment.fulfilledCount) || 0,
              total: Number(confirmedFulfillment.totalLines) || 0,
              allFulfilled: confirmedFulfillment.allProductLinesFulfilled === true,
            }
          : null;
        if (!progress) {
          try {
            const response = await api(`/asset-requests/${fulfillingId}`);
            progress = fulfillmentProgress(response.data);
          } catch (statusError) {
            setError(
              `Goods issue saved, but fulfillment status could not be confirmed: ${statusError.message}`
            );
          }
        }

        if (progress?.allFulfilled && canCompleteRequest) {
          try {
            await api(`/asset-requests/${fulfillingId}/complete`, { method: 'POST', body: {} });
            setMsg(
              wantsPod
                ? 'Final package prepared and POD booked. Linked Goods Issuance Request completed.'
                : 'Final package prepared. Linked Goods Issuance Request completed.'
            );
          } catch (reqErr) {
            setError(
              `All packages were prepared, but request completion failed: ${reqErr.message}`
            );
          }
        } else if (progress?.allFulfilled) {
          setMsg(
            wantsPod
              ? 'All packages prepared and POD booked. An authorized approver must complete the request.'
              : 'All packages are prepared. An authorized approver must complete the request.'
          );
        } else if (progress) {
          const confirmed = form.packageStatus === 'No stock'
            ? 'No stock'
            : wantsPod
              ? 'POD booked'
              : 'Package ready';
          setMsg(
            `Package confirmed (${form.packageStatus || 'prepared'}). ${confirmed}. ${progress.fulfilled} of ${progress.total} packages done.`
          );
        }
      } else {
        setMsg(
          wantsPod
            ? lines.length > 1
              ? `Goods issue saved (${lines.length} products) and POD booked.`
              : 'Goods issue saved and POD booked.'
            : lines.length > 1
            ? `Goods issue saved (${lines.length} products). Kept Open until delivery / RTO is marked.`
            : 'Goods issue saved and kept Open until delivery / RTO is marked.'
        );
      }

      setFormOpen(false);
      if (wantsPod) {
        setMode('pods');
        setPodDateFrom(todayLocalDate());
        setPodDateTo(todayLocalDate());
        setPodPage(1);
      } else if (fulfillingId) {
        setMode('requests');
      }
      setFulfillingId('');
      setFulfillingLineId('');
      setFulfillingLineIndex(null);
      loadRows();
      loadRequests();
      if (wantsPod) loadPods();
      return;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="logistics-inout ilog-flow">
      <p className="muted" style={{ marginTop: 0 }}>
        Prepare package (Courier: pick courier + AWB in the same step). Mark Delivered or
        RTO when the shipment completes — it closes automatically. Use Track for AWB status.
      </p>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      <div className="ilog-source-tabs" role="tablist" aria-label="Outward mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={`ilog-source-tab${mode === 'manual' ? ' is-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual goods issue
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'requests'}
          className={`ilog-source-tab${mode === 'requests' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('requests');
            setFormOpen(false);
          }}
        >
          From Request One
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'pods'}
          className={`ilog-source-tab${mode === 'pods' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('pods');
            setFormOpen(false);
          }}
        >
          PODs
        </button>
      </div>

      {mode === 'manual' && (
        <>
          <MasterFilterShell
            actions={
              <>
                <button className="btn secondary btn-compact" type="button" onClick={loadRows}>
                  Refresh
                </button>
                {canWrite ? (
                  <button
                    className="btn btn-compact"
                    type="button"
                    onClick={() => {
                      if (formOpen && !fulfillingId) {
                        setFormOpen(false);
                        return;
                      }
                      openManual();
                    }}
                  >
                    {formOpen && !fulfillingId ? 'Close form' : '+ Manual goods issue'}
                  </button>
                ) : null}
                <Link className="btn secondary btn-compact" to="/request-one?type=LOGISTICS">
                  Create Goods Issuance Request
                </Link>
              </>
            }
          >
            <MasterSearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRows()}
              placeholder="Search TXN, product, recipient, AWB…"
              aria-label="Search goods issues"
            />
            <AdaptiveSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Goods issue status filter"
            >
              {GOODS_ISSUE_STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </AdaptiveSelect>
          </MasterFilterShell>

          {canWrite && formOpen && (
            <form className="card logistics-form logistics-txn-form" onSubmit={save}>
              <h3>{fulfillingId ? 'Prepare package' : 'Manual goods issue'}</h3>

              {!fulfillingId ? (
                <>
                  <h4 className="logistics-form-section">Section 1</h4>
                  <div className="logistics-form-grid logistics-form-grid--inout">
                    <Field label="Issue kind" required>
                      <AdaptiveSelect
                        required
                        value={normalizeIssueKind(form.logisticsKind)}
                        onChange={(e) => onIssueKindChange(e.target.value)}
                      >
                        {issueKinds.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                    <Field label="Priority" required>
                      <AdaptiveSelect
                        required
                        value={form.priority || 'Medium'}
                        onChange={(e) => setField('priority', e.target.value)}
                      >
                        {ISSUE_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                    <Field label="Delivery mode" required>
                      <AdaptiveSelect
                        required
                        value={mapDeliveryMode(form.deliveryMode) || ''}
                        onChange={(e) => setField('deliveryMode', e.target.value)}
                      >
                        <option value="">Select delivery mode</option>
                        {FALLBACK_DELIVERY.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                  </div>

                  <h4 className="logistics-form-section">Section 2 · Products</h4>
                  <fieldset className="arq-product-group">
                    <legend>Products *</legend>
                    <div className="arq-product-list">
                      {(form.logisticsProducts || []).map((item, index) => {
                        const selectedElsewhere = new Set(
                          (form.logisticsProducts || [])
                            .filter((_, i) => i !== index)
                            .map((row) => String(row.productId))
                            .filter(Boolean)
                        );
                        const matchingProducts = products.filter(
                          (product) =>
                            (!item.productType ||
                              resolveProductType(product.productType) === item.productType) &&
                            !selectedElsewhere.has(String(product._id))
                        );
                        const product = products.find(
                          (p) => String(p._id) === String(item.productId)
                        );
                        const meta = lineTrackingMeta(
                          item.productType,
                          product,
                          categoryDefaults
                        );
                        const trackingKind = item.trackingKind || meta.trackingKind;
                        const expiryApplicable =
                          item.expiryApplicable != null
                            ? !!item.expiryApplicable
                            : meta.expiryApplicable;
                        const showSerial = lineNeedsSerial(trackingKind);
                        const showBatch = lineNeedsBatch(trackingKind);
                        const lineLots =
                          stockLotsByProductId[String(item.productId || '')] || [];
                        const lineBatchOpts = batchOptionsFromLots(
                          lineLots,
                          item.expiryDate || ''
                        );
                        const lineExpiryOpts = expiryOptionsFromLots(
                          lineLots,
                          item.batchNumber || ''
                        );
                        const lineSerialOpts = serialOptionsFromLots(
                          lineLots,
                          item.batchNumber || '',
                          item.expiryDate || ''
                        );
                        return (
                          <div className="arq-product-row" key={`issue-product-${index}`}>
                            <div className="field">
                              <label>Product category *</label>
                              <AdaptiveSelect
                                required
                                value={item.productType}
                                disabled={form.logisticsProductsConfirmed}
                                onChange={(event) => {
                                  const nextType = event.target.value;
                                  const nextMeta = lineTrackingMeta(
                                    nextType,
                                    null,
                                    categoryDefaults
                                  );
                                  updateIssueProduct(index, {
                                    productType: nextType,
                                    productId: '',
                                    productName: '',
                                    trackingKind: nextMeta.trackingKind,
                                    expiryApplicable: nextMeta.expiryApplicable,
                                    serialNumber: '',
                                    batchNumber: '',
                                    expiryDate: '',
                                  });
                                }}
                              >
                                <option value="">Select category</option>
                                {productTypes.map((productType) => (
                                  <option key={productType} value={productType}>
                                    {productType}
                                  </option>
                                ))}
                              </AdaptiveSelect>
                            </div>
                            <div className="field">
                              <label>Model/Variant/Name *</label>
                              <AdaptiveSelect
                                required
                                value={item.productId}
                                disabled={!item.productType || form.logisticsProductsConfirmed}
                                onChange={(event) =>
                                  selectIssueProduct(index, event.target.value)
                                }
                              >
                                <option value="">
                                  {item.productType
                                    ? 'Select model / variant / name'
                                    : 'Select category first'}
                                </option>
                                {matchingProducts.map((p) => (
                                  <option key={p._id} value={p._id}>
                                    {productLabel(p)}
                                    {p.code ? ` (${p.code})` : ''}
                                  </option>
                                ))}
                              </AdaptiveSelect>
                            </div>
                            <div className="field">
                              <label>Qty *</label>
                              <input
                                required
                                type="number"
                                disabled={form.logisticsProductsConfirmed}
                                min="0.01"
                                step="any"
                                value={item.qty}
                                onChange={(event) =>
                                  updateIssueProduct(index, { qty: event.target.value })
                                }
                              />
                            </div>
                            {showSerial && (
                              <div className="field">
                                <label>Serial number *</label>
                                {lineSerialOpts.length ? (
                                  <AdaptiveSelect
                                    required
                                    disabled={
                                      !item.productId || form.logisticsProductsConfirmed
                                    }
                                    value={item.serialNumber || ''}
                                    onChange={(event) =>
                                      updateIssueProduct(index, {
                                        serialNumber: event.target.value,
                                      })
                                    }
                                  >
                                    <option value="">Select serial</option>
                                    {lineSerialOpts.map((serial) => (
                                      <option key={serial} value={serial}>
                                        {serial}
                                      </option>
                                    ))}
                                  </AdaptiveSelect>
                                ) : (
                                <input
                                  required
                                  disabled={form.logisticsProductsConfirmed}
                                  value={item.serialNumber || ''}
                                  onChange={(event) =>
                                    updateIssueProduct(index, {
                                      serialNumber: event.target.value,
                                    })
                                  }
                                    placeholder={
                                      item.productId
                                        ? 'No serial in stock'
                                        : 'Select product first'
                                    }
                                  />
                                )}
                              </div>
                            )}
                            {showBatch && (
                              <div className="field">
                                <label>Batch number *</label>
                                <AdaptiveSelect
                                  required
                                  disabled={
                                    !item.productId || form.logisticsProductsConfirmed
                                  }
                                  value={item.batchNumber || ''}
                                  onChange={(event) => {
                                    const picked = pickBatchFromLots(
                                      lineLots,
                                      event.target.value,
                                      item.expiryDate || ''
                                    );
                                    updateIssueProduct(index, {
                                      batchNumber: picked.batchNumber,
                                      expiryDate: expiryApplicable
                                        ? picked.expiryDate
                                        : '',
                                      serialNumber: showSerial ? '' : item.serialNumber || '',
                                    });
                                  }}
                                >
                                  <option value="">
                                    {item.productId
                                      ? lineBatchOpts.length
                                        ? 'Select batch'
                                        : 'No batch in stock'
                                      : 'Select product first'}
                                  </option>
                                  {lineBatchOpts.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.value}
                                      {opt.qty ? ` (qty ${opt.qty})` : ''}
                                    </option>
                                  ))}
                                </AdaptiveSelect>
                              </div>
                            )}
                            {expiryApplicable && (
                              <div className="field">
                                <label>Expiry date *</label>
                                <AdaptiveSelect
                                  required
                                  aria-label="Expiry date"
                                  disabled={
                                    !item.productId || form.logisticsProductsConfirmed
                                  }
                                  value={item.expiryDate || ''}
                                  onChange={(event) => {
                                    const picked = pickExpiryFromLots(
                                      lineLots,
                                      event.target.value,
                                      item.batchNumber || ''
                                    );
                                    updateIssueProduct(index, {
                                      batchNumber: showBatch
                                        ? picked.batchNumber
                                        : item.batchNumber || '',
                                      expiryDate: picked.expiryDate,
                                      serialNumber: showSerial ? '' : item.serialNumber || '',
                                    });
                                  }}
                                >
                                  <option value="">
                                    {item.productId
                                      ? lineExpiryOpts.length
                                        ? 'Select expiry'
                                        : 'No expiry in stock'
                                      : 'Select product first'}
                                  </option>
                                  {lineExpiryOpts.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {formatDate(opt.value) || opt.value}
                                      {opt.qty ? ` (qty ${opt.qty})` : ''}
                                    </option>
                                  ))}
                                </AdaptiveSelect>
                              </div>
                            )}
                            <button
                              className="btn secondary btn-compact arq-product-remove"
                              type="button"
                              disabled={form.logisticsProductsConfirmed}
                              onClick={() => removeIssueProduct(index)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      disabled={form.logisticsProductsConfirmed}
                      onClick={addIssueProduct}
                    >
                      + Add product
                    </button>
                    <button
                      className="btn btn-compact"
                      type="button"
                      onClick={() =>
                        form.logisticsProductsConfirmed
                          ? setForm((prev) => ({ ...prev, logisticsProductsConfirmed: false }))
                          : confirmIssueProducts()
                      }
                    >
                      {form.logisticsProductsConfirmed ? 'Change products' : 'Confirm products'}
                    </button>
                  </fieldset>

                  {form.logisticsProductsConfirmed && (
                    <>
                      <h4 className="logistics-form-section">Section 3 · Parties</h4>
                      {showFrom ? (
                        <DirectoryPartyFields
                          label="Sender"
                          prefix="from"
                          contacts={contacts}
                          form={form}
                          setForm={setForm}
                        />
                      ) : null}
                      {showTo ? (
                        <DirectoryPartyFields
                          label="Send to / Recipient"
                          prefix="to"
                          contacts={contacts}
                          form={form}
                          setForm={setForm}
                        />
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <div className="logistics-prepare-package">
                  <section className="logistics-prepare-section" aria-labelledby="prep-goods">
                    <h4 id="prep-goods" className="logistics-form-section">
                      Goods Info
                    </h4>
                    <div className="logistics-prepare-grid logistics-prepare-grid--goods">
                    <Field label="Issue kind">
                        <input
                          readOnly
                          className="is-readonly"
                          value={normalizeIssueKind(form.logisticsKind)}
                        />
                    </Field>
                      <Field label="Product category">
                        <input
                          readOnly
                          className="is-readonly"
                          value={form.productType || ''}
                        />
                      </Field>
                      <Field label="Model / Variant / Name">
                        <input
                          readOnly
                          className="is-readonly"
                          value={form.productName || ''}
                        />
                      </Field>
                      <Field
                        label="Qty"
                        required={form.packageStatus === 'Partially ready'}
                      >
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required={form.packageStatus !== 'No stock'}
                          readOnly={form.packageStatus !== 'Partially ready'}
                          className={
                            form.packageStatus !== 'Partially ready' ? 'is-readonly' : undefined
                          }
                          value={form.qty || ''}
                          onChange={(e) => setField('qty', e.target.value)}
                        />
                      </Field>
                      <Field label="UOM">
                        <input
                          readOnly
                          className="is-readonly"
                          value={uomLabel(form.uomId) || '—'}
                        />
                      </Field>
                      <Field
                        label="Delivery mode"
                        required={form.packageStatus !== 'No stock'}
                      >
                      <AdaptiveSelect
                          required={form.packageStatus !== 'No stock'}
                          value={mapDeliveryMode(form.deliveryMode) || ''}
                          onChange={(e) => {
                            const deliveryMode = e.target.value;
                            setForm((prev) => ({
                              ...prev,
                              deliveryMode,
                              ...(mapDeliveryMode(deliveryMode) === 'Courier'
                                ? applyFixedPodOrigin({
                                    fromCity: 'Mumbai',
                                    fromState: 'Maharashtra',
                                  })
                                : { awbNumber: '', podCourierId: '' }),
                            }));
                          }}
                        >
                          <option value="">Select delivery mode</option>
                          {FALLBACK_DELIVERY.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                      {form.packageStatus !== 'No stock' && lineNeedsBatch(form.trackingKind) ? (
                        <Field label="Batch number" required>
                      <AdaptiveSelect
                        required
                            disabled={!form.productId}
                            value={form.batchNumber || ''}
                            onChange={(e) => {
                              const picked = pickBatchFromLots(
                                fulfillLots,
                                e.target.value,
                                form.expiryDate || ''
                              );
                              setForm((f) => ({
                                ...f,
                                batchNumber: picked.batchNumber,
                                expiryDate: f.expiryApplicable ? picked.expiryDate : '',
                                serialNumber: lineNeedsSerial(f.trackingKind)
                                  ? ''
                                  : f.serialNumber || '',
                              }));
                            }}
                          >
                            <option value="">
                              {form.productId
                                ? fulfillBatchOpts.length
                                  ? 'Select batch'
                                  : 'No batch in stock'
                                : 'Select product first'}
                            </option>
                            {fulfillBatchOpts.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.value}
                                {opt.qty ? ` (qty ${opt.qty})` : ''}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                      ) : (
                        <Field label="Batch number">
                          <input readOnly className="is-readonly" value="N/A" />
                    </Field>
                      )}
                      {form.packageStatus !== 'No stock' && form.expiryApplicable ? (
                        <Field label="Expiry date" required>
                          <AdaptiveSelect
                            required
                            aria-label="Expiry date"
                            disabled={!form.productId}
                            value={form.expiryDate || ''}
                            onChange={(e) => {
                              const picked = pickExpiryFromLots(
                                fulfillLots,
                                e.target.value,
                                form.batchNumber || ''
                              );
                              setForm((f) => ({
                                ...f,
                                batchNumber: lineNeedsBatch(f.trackingKind)
                                  ? picked.batchNumber
                                  : f.batchNumber || '',
                                expiryDate: picked.expiryDate,
                                serialNumber: lineNeedsSerial(f.trackingKind)
                                  ? ''
                                  : f.serialNumber || '',
                              }));
                            }}
                          >
                            <option value="">
                              {form.productId
                                ? fulfillExpiryOpts.length
                                  ? 'Select expiry'
                                  : 'No expiry in stock'
                                : 'Select product first'}
                            </option>
                            {fulfillExpiryOpts.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {formatDate(opt.value) || opt.value}
                                {opt.qty ? ` (qty ${opt.qty})` : ''}
                              </option>
                            ))}
                          </AdaptiveSelect>
                        </Field>
                      ) : form.packageStatus !== 'No stock' &&
                        lineNeedsSerial(form.trackingKind) &&
                        !form.expiryApplicable ? (
                      <Field label="Serial number" required>
                          {fulfillSerialOpts.length ? (
                            <AdaptiveSelect
                              required
                              value={form.serialNumber || ''}
                              onChange={(e) => setField('serialNumber', e.target.value)}
                            >
                              <option value="">Select serial</option>
                              {fulfillSerialOpts.map((serial) => (
                                <option key={serial} value={serial}>
                                  {serial}
                                </option>
                              ))}
                            </AdaptiveSelect>
                          ) : (
                        <input
                          required
                          value={form.serialNumber || ''}
                          onChange={(e) => setField('serialNumber', e.target.value)}
                              placeholder="No serial in stock"
                        />
                          )}
                        </Field>
                      ) : (
                        <Field label="Expiry date">
                          <input readOnly className="is-readonly" value="N/A" />
                      </Field>
                    )}
                      {form.packageStatus !== 'No stock' &&
                      lineNeedsSerial(form.trackingKind) &&
                      form.expiryApplicable ? (
                        <Field label="Serial number" required>
                          {fulfillSerialOpts.length ? (
                            <AdaptiveSelect
                              required
                              value={form.serialNumber || ''}
                              onChange={(e) => setField('serialNumber', e.target.value)}
                            >
                              <option value="">Select serial</option>
                              {fulfillSerialOpts.map((serial) => (
                                <option key={serial} value={serial}>
                                  {serial}
                                </option>
                              ))}
                            </AdaptiveSelect>
                          ) : (
                        <input
                          required
                              value={form.serialNumber || ''}
                              onChange={(e) => setField('serialNumber', e.target.value)}
                              placeholder="No serial in stock"
                            />
                          )}
                        </Field>
                      ) : null}
                    </div>
                  </section>

                  {(() => {
                    const noStock = form.packageStatus === 'No stock';
                    const deliverySection = (
                      <section
                        key="prep-delivery"
                        className="logistics-prepare-section"
                        aria-labelledby="prep-delivery"
                      >
                        <h4 id="prep-delivery" className="logistics-form-section">
                          {prepareFixedDestination
                            ? 'Destination Details'
                            : prepareShowSender && prepareShowRecipient
                              ? 'Recipient Details'
                              : 'Delivery Details'}
                        </h4>
                        {noStock ? (
                          <p className="muted logistics-prepare-lede">
                            Addresses are not required when package status is No stock.
                          </p>
                        ) : prepareFixedDestination ? (
                          <>
                            <p className="muted logistics-prepare-lede">
                              Destination is fixed at Tylo Care HQ for Recall / Pickup.
                            </p>
                            <div className="logistics-prepare-grid logistics-prepare-grid--origin">
                              <Field label="Name" required>
                                <input
                          required
                                  value={form.toName || ''}
                                  onChange={(e) => setField('toName', e.target.value)}
                        />
                      </Field>
                              <Field label="Phone" required>
                                <input
                                  required
                                  value={form.toNumber || ''}
                                  onChange={(e) => setField('toNumber', e.target.value)}
                                />
                              </Field>
                              <Field label="Pin code" required>
                                <input
                                  required
                                  value={form.toPinCode || ''}
                                  onChange={(e) => setField('toPinCode', e.target.value)}
                                />
                              </Field>
                              <Field label="Address" required>
                                <input
                                  required
                                  value={form.toAddress || ''}
                                  onChange={(e) => setField('toAddress', e.target.value)}
                                />
                              </Field>
                  </div>
                          </>
                        ) : prepareShowRecipient ? (
                    <DirectoryPartyFields
                            label="Recipient"
                            prefix="to"
                      contacts={contacts}
                      form={form}
                      setForm={setForm}
                    />
                        ) : null}
                      </section>
                    );

                    const originSection =
                      !noStock && (prepareFixedOrigin || prepareShowSender) ? (
                        <section
                          key="prep-origin"
                          className="logistics-prepare-section"
                          aria-labelledby="prep-origin"
                        >
                          <h4 id="prep-origin" className="logistics-form-section">
                            {prepareFixedOrigin
                              ? 'Origin Details'
                              : issueKind === 'Recall / Pickup'
                                ? 'Pickup / Origin Details'
                                : 'Sender Details'}
                          </h4>
                          {prepareFixedOrigin ? (
                            <>
                              <p className="muted logistics-prepare-lede">
                                Origin is fixed at Tylo Care HQ for Fresh Dispatch.
                              </p>
                              <div className="logistics-prepare-grid logistics-prepare-grid--origin">
                                <Field label="Name" required>
                                  <input
                                    required
                                    value={form.fromName || ''}
                                    onChange={(e) => setField('fromName', e.target.value)}
                                  />
                                </Field>
                                <Field label="Phone" required>
                                  <input
                                    required
                                    value={form.fromNumber || ''}
                                    onChange={(e) => setField('fromNumber', e.target.value)}
                                  />
                                </Field>
                                <Field label="Pin code" required>
                                  <input
                                    required
                                    value={form.fromPinCode || ''}
                                    onChange={(e) => setField('fromPinCode', e.target.value)}
                                  />
                                </Field>
                                <Field label="Address" required>
                                  <input
                                    required
                                    value={form.fromAddress || ''}
                                    onChange={(e) => setField('fromAddress', e.target.value)}
                                  />
                                </Field>
                              </div>
                            </>
                          ) : (
                    <DirectoryPartyFields
                              label={
                                issueKind === 'Recall / Pickup' ? 'Pickup from' : 'Sender'
                              }
                              prefix="from"
                      contacts={contacts}
                      form={form}
                      setForm={setForm}
                    />
                  )}
                        </section>
                      ) : null;

                    // Inter Transfer: Sender then Recipient (both from Request One)
                    if (issueKind === 'Inter Transfer') {
                      return (
                        <>
                          {originSection}
                          {deliverySection}
                        </>
                      );
                    }
                    // Fresh Dispatch: Delivery then fixed Origin
                    // Recall / Pickup: fixed Destination then Pickup origin
                    return (
                      <>
                        {deliverySection}
                        {originSection}
                      </>
                    );
                  })()}

                  <section
                    className="logistics-prepare-section"
                    aria-labelledby="prep-shipment"
                  >
                    <h4 id="prep-shipment" className="logistics-form-section">
                      Shipment Overview
                    </h4>
                    <div className="logistics-prepare-grid logistics-prepare-grid--shipment">
                      <Field label="Package status" required>
                        <AdaptiveSelect
                        required
                          value={form.packageStatus || ''}
                          onChange={(e) => setField('packageStatus', e.target.value)}
                        >
                          <option value="">Select status</option>
                          {PACKAGE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </AdaptiveSelect>
                      </Field>
                      {prepareIsCourier && form.packageStatus !== 'No stock' ? (
                        <>
                          <Field label="Length (cm)" required>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              aria-label="Length cm"
                              placeholder="L"
                              value={form.packageLength || ''}
                              onChange={(e) => setField('packageLength', e.target.value)}
                      />
                    </Field>
                          <Field label="Width (cm)" required>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              aria-label="Width cm"
                              placeholder="W"
                              value={form.packageWidth || ''}
                              onChange={(e) => setField('packageWidth', e.target.value)}
                            />
                          </Field>
                          <Field label="Height (cm)" required>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              aria-label="Height cm"
                              placeholder="H"
                              value={form.packageHeight || ''}
                              onChange={(e) => setField('packageHeight', e.target.value)}
                            />
                          </Field>
                          <Field label="Weight (kg)" required>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={form.packageWeight || ''}
                              onChange={(e) => setField('packageWeight', e.target.value)}
                              placeholder="0.00"
                            />
                          </Field>
                          <Field
                            label="Applicable weight"
                            hint={
                              packageVolumetricKg != null
                                ? `Volumetric ${formatWeightKg(packageVolumetricKg)} kg`
                                : 'Max of weight & L×W×H÷5000'
                            }
                          >
                            <input
                              readOnly
                              className="is-readonly"
                              value={
                                packageApplicableKg == null
                                  ? ''
                                  : `${formatWeightKg(packageApplicableKg)} kg`
                              }
                              placeholder="Auto"
                            />
                          </Field>
                          <Field label="Declared price (₹)" required>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={form.declaredPrice || ''}
                              onChange={(e) => setField('declaredPrice', e.target.value)}
                              placeholder="0"
                            />
                          </Field>
                      <Field label="AWB number" required>
                        <input
                          required
                              value={form.awbNumber || ''}
                          onChange={(e) => setField('awbNumber', e.target.value)}
                              placeholder="Enter AWB after booking"
                        />
                      </Field>
                        </>
                      ) : null}
                    </div>
                  </section>

                  {prepareIsCourier && form.packageStatus !== 'No stock' ? (
                    <section className="logistics-prepare-section" aria-labelledby="prep-pod">
                      <h4 id="prep-pod" className="logistics-form-section">
                        Book POD
                      </h4>
                      <div className="logistics-prepare-courier-table table-wrap">
                        <table className="inv-table">
                          <thead>
                            <tr>
                              <th>Mode</th>
                              <th>Courier</th>
                              <th>Service Type</th>
                              <th>Category</th>
                              <th className="num">Est. ₹</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courierQuoteOptions.map((opt) => {
                              const selected = String(form.podCourierId) === opt.id;
                              const isSurface =
                                String(opt.mode || '').toLowerCase() === 'surface';
                              const ModeIcon = isSurface ? Truck : Plane;
                              const modeLabel = isSurface ? 'Surface' : 'Air';
                              return (
                                <tr
                                  key={opt.id}
                                  className={
                                    selected
                                      ? 'pod-courier-row is-selected'
                                      : 'pod-courier-row'
                                  }
                                >
                                  <td>
                                    <button
                                      type="button"
                                      className={`pod-mode-icon-btn${
                                        selected ? ' is-selected' : ''
                                      }${isSurface ? ' is-surface' : ' is-air'}`}
                                      aria-pressed={selected}
                                      aria-label={`Select ${opt.name} (${modeLabel})`}
                                      title={modeLabel}
                                      onClick={() => setField('podCourierId', opt.id)}
                                    >
                                      <ModeIcon size={18} strokeWidth={2} aria-hidden />
                                      <span className="pod-mode-label">{modeLabel}</span>
                                    </button>
                                  </td>
                                  <td>
                                    <strong>{opt.courier || opt.name}</strong>
                                    {opt.isCheapest ? (
                                      <span className="badge tone-ok pod-cheapest-badge">
                                        Cheapest
                                      </span>
                                    ) : null}
                                  </td>
                                  <td>{opt.serviceType || '—'}</td>
                                  <td>{opt.categoryLabel || opt.zoneLabel || '—'}</td>
                                  <td className="num">
                                    {opt.estimate != null ? opt.estimate.toFixed(2) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                            {!courierQuoteOptions.length && (
                              <tr>
                                <td colSpan={5} className="muted">
                                  Enter weight and dimensions above to compare couriers.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                  </div>
                    </section>
                  ) : null}
                </div>
              )}

              <div className="logistics-form-actions">
                <button className="btn" type="submit" disabled={busy}>
                  {busy
                    ? 'Saving…'
                    : fulfillingId
                      ? prepareIsCourier
                        ? 'Confirm package & book POD'
                        : 'Confirm package'
                      : 'Save goods issue'}
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setFulfillingId('');
                    setFulfillingLineId('');
                    setFulfillingLineIndex(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="card card--flush table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>TXN</th>
                  <th>Date</th>
                  <th>Kind</th>
                  <th>Model/Variant/Name</th>
                  <th className="num">Qty</th>
                  <th>Recipient</th>
                  <th>City</th>
                  <th>Mode</th>
                  <th>AWB</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ds = resolveDispatchStatus(r);
                  const open = isDispatchOpen(r);
                  const kind = normalizeIssueKind(r.logisticsKind) || r.entryType || '-';
                  return (
                    <tr key={r._id}>
                      <td className="mono-sm">{r.uniqueKey || '-'}</td>
                      <td className="mono-sm">
                        {formatDate(r.transactionDate || r.transactionDateTime) || '-'}
                      </td>
                      <td>{kind}</td>
                      <td>
                        <strong>{r.productName || r.itemName || '-'}</strong>
                      </td>
                      <td className="num">{r.qty}</td>
                      <td>
                        {r.recipientName ||
                          r.employeeName ||
                          r.name ||
                          r.fromName ||
                          '-'}
                      </td>
                      <td>{r.city || '-'}</td>
                      <td>{mapDeliveryMode(r.deliveryMode || r.mode) || '-'}</td>
                      <td className="mono-sm">{r.awbNumber || '-'}</td>
                      <td>
                        <span
                          className={`badge ${
                            open
                              ? 'tone-warn'
                              : ds === 'RTO'
                                ? 'tone-danger'
                                : 'tone-ok'
                          }`}
                        >
                          {ds}
                        </span>
                      </td>
                      <td className="ilog-actions-cell">
                        {canWrite && open ? (
                          <div className="ilog-row-actions">
                            <button
                              type="button"
                              className="btn secondary btn-compact"
                              disabled={deliveryBusyId === r._id}
                              onClick={() => markDelivery(r, 'Delivered')}
                            >
                              {deliveryBusyId === r._id ? '…' : 'Delivered'}
                            </button>
                            <button
                              type="button"
                              className="btn secondary btn-compact"
                              disabled={deliveryBusyId === r._id}
                              onClick={() => markDelivery(r, 'RTO')}
                            >
                              RTO
                            </button>
                            <a
                              className="btn secondary btn-compact"
                              href={POD_TRACK_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={
                                r.awbNumber
                                  ? `Track AWB ${r.awbNumber} on DTDC`
                                  : 'Track shipment on DTDC'
                              }
                            >
                              Track
                            </a>
                          </div>
                        ) : (
                          <div className="ilog-row-actions">
                            <a
                              className="btn secondary btn-compact"
                              href={POD_TRACK_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={
                                r.awbNumber
                                  ? `Track AWB ${r.awbNumber} on DTDC`
                                  : 'Track shipment on DTDC'
                              }
                            >
                              Track
                            </a>
                          <span className="muted">
                            {r.deliveryOutcome || ds}
                            {r.closedAt ? ` · ${formatDateTime(r.closedAt)}` : ''}
                          </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={11} className="muted">
                      No goods issues yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={listMeta.page || page}
            limit={limit}
            total={listMeta.total || 0}
            pages={listMeta.pages || 0}
            loading={listLoading}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
          />
        </>
      )}

      {mode === 'pods' && (
        <>
          <MasterFilterShell
            actions={
              <>
                <button
                  className="btn secondary btn-compact"
                  type="button"
                  onClick={() => {
                    const today = todayLocalDate();
                    setPodDateFrom(today);
                    setPodDateTo(today);
                    setPodPage(1);
                  }}
                >
                  Today
                </button>
                <button className="btn secondary btn-compact" type="button" onClick={loadPods}>
                  Refresh
                </button>
                {podSelectedIds.size > 0 ? (
                  <>
                    <span className="muted mono-sm">{podSelectedIds.size} selected</span>
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      onClick={clearPodSelection}
                    >
                      Clear select
                    </button>
                    {canWrite ? (
                      <button
                        className="btn btn-compact"
                        type="button"
                        disabled={podBulkBusy || !podOpenSelected.length}
                        title={
                          podOpenSelected.length
                            ? `Mark ${podOpenSelected.length} open POD(s) Delivered`
                            : 'No open PODs in selection'
                        }
                        onClick={() => markPodsBulk('Delivered')}
                      >
                        {podBulkBusy ? '…' : 'Mark Delivered'}
                      </button>
                    ) : null}
                    {adminUser ? (
                      <button
                        className="btn danger btn-compact"
                        type="button"
                        disabled={podBulkBusy || !podSelectedIds.size}
                        title="Delete selected PODs (Admin only)"
                        onClick={deletePodsBulk}
                      >
                        Delete
                      </button>
                    ) : null}
                  </>
                ) : null}
                <button
                  className="btn btn-compact"
                  type="button"
                  disabled={podExportBusy || podLoading}
                  onClick={downloadPodsExcel}
                  title={
                    podSelectedIds.size
                      ? `Download Excel for ${podSelectedIds.size} selected`
                      : 'Download Excel for current date range'
                  }
                >
                  {podExportBusy
                    ? 'Downloading…'
                    : podSelectedIds.size
                      ? `Download Excel (${podSelectedIds.size})`
                      : 'Download Excel'}
                </button>
              </>
            }
          >
            <MasterSearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPods()}
              placeholder="Search TXN, AWB, product, recipient…"
              aria-label="Search PODs"
            />
            <input
              type="date"
              className="master-filter-date"
              value={podDateFrom}
              onChange={(e) => {
                setPodDateFrom(e.target.value);
                setPodPage(1);
              }}
              aria-label="POD booked from"
              title="From"
            />
            <span className="master-filter-date-sep" aria-hidden="true">
              –
            </span>
            <input
              type="date"
              className="master-filter-date"
              value={podDateTo}
              onChange={(e) => {
                setPodDateTo(e.target.value);
                setPodPage(1);
              }}
              aria-label="POD booked to"
              title="To"
            />
          </MasterFilterShell>

          <div className="card card--flush table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={podAllSelected}
                      disabled={!podRows.length}
                      onChange={togglePodSelectAll}
                      aria-label="Select all PODs on this page"
                    />
                  </th>
                  <th>TXN</th>
                  <th>POD booked</th>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th>Recipient</th>
                  <th>City</th>
                  <th>AWB</th>
                  <th>Weight</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {podRows.map((r) => {
                  const ds = resolveDispatchStatus(r);
                  const open = isDispatchOpen(r);
                  const selected = podSelectedIds.has(String(r._id));
                  return (
                    <tr key={r._id} className={selected ? 'is-selected' : undefined}>
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePodSelect(r._id)}
                          aria-label={`Select ${r.uniqueKey || r._id}`}
                        />
                      </td>
                      <td className="mono-sm">{r.uniqueKey || '-'}</td>
                      <td className="mono-sm">
                        {formatDateTime(r.podBookedAt) ||
                          formatDate(r.podBookedAt) ||
                          formatDate(r.transactionDate) ||
                          '-'}
                      </td>
                      <td>
                        <strong>{r.productName || r.itemName || '-'}</strong>
                      </td>
                      <td className="num">{r.qty}</td>
                      <td>{r.recipientName || r.employeeName || r.name || '-'}</td>
                      <td>{r.city || r.toCity || '-'}</td>
                      <td className="mono-sm">{r.awbNumber || '-'}</td>
                      <td className="mono-sm">
                        {r.applicableWeight || r.packageWeight
                          ? `${r.applicableWeight || r.packageWeight} kg`
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            open
                              ? 'tone-warn'
                              : ds === 'RTO'
                                ? 'tone-danger'
                                : 'tone-ok'
                          }`}
                        >
                          {ds}
                        </span>
                      </td>
                      <td className="ilog-actions-cell">
                        {canWrite && open ? (
                          <div className="ilog-row-actions">
                            <button
                              type="button"
                              className="btn secondary btn-compact"
                              disabled={deliveryBusyId === r._id || podBulkBusy}
                              onClick={() => markDelivery(r, 'Delivered')}
                            >
                              {deliveryBusyId === r._id ? '…' : 'Delivered'}
                            </button>
                            <button
                              type="button"
                              className="btn secondary btn-compact"
                              disabled={deliveryBusyId === r._id || podBulkBusy}
                              onClick={() => markDelivery(r, 'RTO')}
                            >
                              RTO
                            </button>
                            <a
                              className="btn secondary btn-compact"
                              href={POD_TRACK_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={
                                r.awbNumber
                                  ? `Track AWB ${r.awbNumber} on DTDC`
                                  : 'Track shipment on DTDC'
                              }
                            >
                              Track
                            </a>
                          </div>
                        ) : (
                          <div className="ilog-row-actions">
                            <a
                              className="btn secondary btn-compact"
                              href={POD_TRACK_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={
                                r.awbNumber
                                  ? `Track AWB ${r.awbNumber} on DTDC`
                                  : 'Track shipment on DTDC'
                              }
                            >
                              Track
                            </a>
                            <span className="muted">
                              {r.deliveryOutcome || ds}
                              {r.closedAt ? ` · ${formatDateTime(r.closedAt)}` : ''}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!podRows.length && (
                  <tr>
                    <td colSpan={11} className="muted">
                      {podLoading
                        ? 'Loading PODs…'
                        : 'No PODs booked in this date range.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={podListMeta.page || podPage}
            limit={podLimit}
            total={podListMeta.total || 0}
            pages={podListMeta.pages || 0}
            loading={podLoading}
            onPageChange={setPodPage}
            onLimitChange={(n) => {
              setPodLimit(n);
              setPodPage(1);
            }}
          />
        </>
      )}

      {mode === 'requests' && (
        <>
          <MasterFilterShell
            actions={
              <>
                <button className="btn secondary btn-compact" type="button" onClick={loadRequests}>
                  Refresh
                </button>
                <Link className="btn btn-compact" to="/request-one?type=LOGISTICS">
                  + New Goods Issuance Request
                </Link>
              </>
            }
          >
            <MasterSearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, product, destination, requestor…"
              aria-label="Search Goods Issuance Requests"
            />
          </MasterFilterShell>
          <div className="card card--flush table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Kind</th>
                  <th>Asset / Item</th>
                  <th>Destination</th>
                  <th>Requestor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const progress = fulfillmentProgress(r);
                  const kind =
                    r.logisticsKind || '-';
                  return (
                  <tr key={r._id}>
                    <td className="mono-sm">{r.requestNumber}</td>
                    <td>
                      <span className="badge tone-neutral">{r.status}</span>
                    </td>
                    <td>{kind}</td>
                    <td>
                      {progress.lines.map((line, index) => (
                        <div key={lineId(line) || index} className="logistics-request-line">
                          <strong>{line.productName || r.assetName || '-'}</strong>
                          <span className="muted mono-sm">
                            {line.productType || 'Product'} · Qty {line.qty || 0}
                            {line.uomId && uomLabel(line.uomId)
                              ? ` ${uomLabel(line.uomId)}`
                              : ''}
                          </span>
                        </div>
                      ))}
                      <div className="muted mono-sm">
                        {progress.fulfilled}/{progress.total} packages prepared
                      </div>
                    </td>
                    <td>
                      {r.toCity || r.toContactId?.city || '-'}
                      <div className="muted mono-sm">
                        {r.toName || r.toContactId?.name || ''}
                      </div>
                    </td>
                    <td>{r.requestorId?.fullName || r.requestorId?.email || '-'}</td>
                    <td>
                      {canWrite &&
                        progress.lines.map((line, index) => {
                          const key = `${r._id}:${lineId(line) || index}`;
                          const fulfilled =
                            requestLineIsFulfilled(r, line, index) || dispatchedLines.has(key);
                          return (
                            <button
                              key={lineId(line) || index}
                              type="button"
                              className="btn btn-compact"
                              disabled={busy || fulfilled}
                              onClick={() => openFromRequest(r, line, index)}
                            >
                              {packageActionLabel(r, line, index)}
                            </button>
                          );
                        })}
                    </td>
                  </tr>
                  );
                })}
                {!filteredRequests.length && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {requests.length
                        ? 'No requests match your search.'
                        : 'No open Goods Issuance Requests. Create one in Request One.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
