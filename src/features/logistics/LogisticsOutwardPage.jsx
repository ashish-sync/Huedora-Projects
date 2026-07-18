import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import {
  FALLBACK_CAT_DEFAULTS,
  FALLBACK_COURIER,
  FALLBACK_DELIVERY,
  FALLBACK_PRODUCT,
  Field,
  GOODS_ISSUE_KINDS,
  emptyTxnForm,
  nowLocal,
  resolveProductType,
} from './logisticsTxnShared.jsx';

const REQUEST_DELIVERY_MODES = [
  'Hand Delivery',
  'Regular Courier',
  'Apex',
  'Porter',
  'Other',
  'Blue Dart',
  'DTDC',
  'Other Courier',
];
const DELIVERY_MODE_ALIASES = {
  'Hand-carry': 'Hand Delivery',
  Courier: 'Regular Courier',
  Road: 'Regular Courier',
};

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

function todayLocalDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

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

/** Contact Directory picker with name, number, address, pin, city, state */
function DirectoryPartyFields({ label, prefix, contacts, form, setForm }) {
  const idKey = `${prefix}ContactId`;
  const fields = [
    { suffix: 'Name', label: 'Name', value: (c) => c.name || '' },
    { suffix: 'Number', label: 'Number', value: contactNumber },
    { suffix: 'Address', label: 'Address', value: (c) => c.address || '' },
    { suffix: 'PinCode', label: 'Pin code', value: (c) => c.pinCode || '' },
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
            <div className="field" key={field.suffix}>
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
  return (
    status === 'FULFILLED' ||
    status === 'DISPATCHED' ||
    Boolean(line?.fulfilledAt || line?.outwardTransactionId || line?.dispatchId)
  );
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

function mapDeliveryMode(mode) {
  return DELIVERY_MODE_ALIASES[mode] || mode || 'Hand Delivery';
}

function resolveDispatchStatus(row) {
  const s = String(row?.dispatchStatus || '').trim();
  if (s) return s;
  const entry = String(row?.entryType || '');
  if (entry === 'Outward' || entry === 'Return' || !entry) return 'Open';
  return '';
}

function isDispatchOpen(row) {
  return resolveDispatchStatus(row) === 'Open';
}

export default function LogisticsOutwardPage() {
  const { can, user } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const canCompleteRequest =
    can('asset-requests:approve') || can('movements:approve') || can('*');
  const [mode, setMode] = useState('manual'); // manual | requests
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
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

  const cfg = meta?.inOut || {};
  const productTypes = cfg.productTypes || FALLBACK_PRODUCT;
  const deliveryModes = [
    ...new Set([...(cfg.deliveryModes || FALLBACK_DELIVERY), ...REQUEST_DELIVERY_MODES]),
  ];
  const courierModes = [
    ...new Set([
      ...(cfg.courierModes || FALLBACK_COURIER),
      'Regular Courier',
      'Apex',
      'Other',
      'Blue Dart',
      'DTDC',
      'Other Courier',
    ]),
  ];
  const issueKinds = cfg.goodsIssueKinds || GOODS_ISSUE_KINDS;
  const showFrom = needsFromContact(form.logisticsKind);
  const showTo = needsToContact(form.logisticsKind);
  const categoryDefaults = cfg.categoryDefaults || FALLBACK_CAT_DEFAULTS;
  const warehouses = meta?.warehouses || [];
  const products = meta?.products || [];
  const defaultWarehouseName = cfg.defaultWarehouseName || 'Mumbai';

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

  const needsAwb = courierModes.includes(form.deliveryMode);

  const loadRows = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200', entryTypes: 'Outward,Return' });
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter && statusFilter !== 'All') params.set('dispatchStatus', statusFilter);
      const res = await api(`/logistics/in-out?${params}`);
      const list = (res.data || []).filter(
        (r) => r.entryType !== 'Return' || Boolean(r.logisticsKind)
      );
      setRows(list);
    } catch (e) {
      setError(e.message);
    }
  }, [q, statusFilter]);

  const markDelivery = async (row, outcome) => {
    if (!canWrite || !row?._id) return;
    const label = outcome === 'RTO' ? 'RTO' : outcome === 'Closed' ? 'Closed' : 'Delivered';
    if (!window.confirm(`Mark this goods issue as ${label}? It will leave Open status.`)) return;
    setDeliveryBusyId(row._id);
    setError('');
    setMsg('');
    try {
      await api(`/logistics/in-out/${row._id}/delivery`, {
        method: 'PATCH',
        body: { outcome },
      });
      setMsg(`Goods issue marked ${label}.`);
      await loadRows();
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

  useEffect(() => {
    api('/logistics/meta')
      .then((r) => setMeta(r.data))
      .catch(() => {});
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (mode === 'requests') loadRequests();
  }, [mode, loadRequests]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const productLabel = (p) => p?.model || p?.partNumber || p?.name || '';

  const openManual = () => {
    const base = emptyTxnForm(user, {
      entryType: 'Outward',
      warehouseId: defaultWarehouseId,
    });
    base.logisticsKind = 'Fresh Dispatch';
    base.priority = 'Medium';
    base.preferredDate = todayLocalDate();
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
    base.fromContactId = refId(req.fromContactId);
    base.fromName = req.fromName || req.fromContactId?.name || '';
    base.fromCity = req.fromCity || req.fromContactId?.city || '';
    base.fromState = req.fromState || req.fromContactId?.state || '';
    base.fromNumber = req.fromNumber || req.fromContactId?.contact || req.fromContactId?.mobile || '';
    base.fromAddress = req.fromAddress || req.fromContactId?.address || '';
    base.fromPinCode = req.fromPinCode || req.fromContactId?.pinCode || '';
    base.toContactId = refId(req.toContactId);
    base.toName = req.toName || req.toContactId?.name || '';
    base.toCity = req.toCity || req.toContactId?.city || '';
    base.toState = req.toState || req.toContactId?.state || '';
    base.toNumber = req.toNumber || req.toContactId?.contact || req.toContactId?.mobile || '';
    base.toAddress = req.toAddress || req.toContactId?.address || '';
    base.toPinCode = req.toPinCode || req.toContactId?.pinCode || '';
    base.contactId = base.toContactId;
    base.recipientName = base.toName;
    base.city = base.toCity;
    base.state = base.toState;
    base.number = base.toNumber;
    base.productType = requestedType;
    base.productId = refId(line?.productId);
    base.productName = line?.productName || line?.productId?.name || '';
    base.qty = String(line?.qty || 1);
    base.deliveryMode = mapDeliveryMode(req.transportMode);
    base.remark = `Fulfill ${req.requestNumber || req._id} line ${lineIndex + 1}${
      kind ? ` · ${kind}` : ''
    }`;
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
      base.productName = productLabel(match) || match.name;
      base.productType = match.productType || base.productType;
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
    setForm((f) => ({
      ...f,
      logisticsKind: next,
      ...emptyContactPrefix('from'),
      ...emptyContactPrefix('to'),
      contactId: '',
      recipientName: '',
      empId: '',
      number: '',
      city: '',
      state: '',
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
      productName: productLabel(product),
      productType: type,
      trackingKind: meta.trackingKind,
      expiryApplicable: meta.expiryApplicable,
      serialNumber: lineNeedsSerial(meta.trackingKind)
        ? form.logisticsProducts[index]?.serialNumber || ''
        : '',
      batchNumber: lineNeedsBatch(meta.trackingKind)
        ? form.logisticsProducts[index]?.batchNumber || ''
        : '',
      expiryDate: meta.expiryApplicable
        ? form.logisticsProducts[index]?.expiryDate || ''
        : '',
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
      productName: productLabel(p),
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
    if (!form.deliveryMode) {
      setError('Select Delivery mode.');
      return;
    }
    if (needsAwb && !String(form.awbNumber || '').trim()) {
      setError('AWB number is required for courier delivery modes.');
      return;
    }
    if (needsFromContact(kind) && !form.fromContactId) {
      setError('Select Sender from Contact Directory.');
      return;
    }
    if (needsToContact(kind) && !(form.toContactId || form.contactId)) {
      setError('Select Send to / Recipient from Contact Directory.');
      return;
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
      setError('This request product line was already issued. Refresh the request list.');
      return;
    }
    try {
      const entryType = entryTypeForKind(kind);
      const preferredDate = form.preferredDate || todayLocalDate();
      const txnAt = `${preferredDate}T${String(nowLocal()).slice(11, 16)}`;
      let lastResult = null;

      for (const line of lines) {
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

        lastResult = await api('/logistics/in-out', {
          method: 'POST',
          body: {
            entryType,
            logisticsKind: kind,
            priority: form.priority || 'Medium',
            preferredDate,
            deliveryMode: form.deliveryMode,
            warehouseId: form.warehouseId || defaultWarehouseId || null,
            sourceWarehouseId: form.warehouseId || defaultWarehouseId || null,
            contactId: form.toContactId || form.contactId || null,
            fromContactId: form.fromContactId || null,
            fromName: form.fromName || '',
            fromNumber: form.fromNumber || '',
            fromAddress: form.fromAddress || '',
            fromPinCode: form.fromPinCode || '',
            fromCity: form.fromCity || '',
            fromState: form.fromState || '',
            productId: line.productId || null,
            productType: line.productType || product?.productType || '',
            productName: line.productName || productLabel(product) || '',
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
            perUnitCost: Number(product?.defaultPerUnitCost || form.perUnitCost) || 0,
            trackingKind,
            batchOrSerial,
            serialNumber,
            batchNumber,
            expiryApplicable,
            expiryDate: expiryApplicable ? expiryDate : '',
            transactionDateTime: txnAt,
            transactionDate: preferredDate,
            awbNumber: needsAwb ? form.awbNumber : '',
            remark: form.remark || kind,
          },
        });
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
            setMsg('Final product line issued and linked goods issue request completed.');
          } catch (reqErr) {
            setError(
              `All product lines were issued, but request completion failed: ${reqErr.message}`
            );
          }
        } else if (progress?.allFulfilled) {
          setMsg(
            'All product lines are issued. An authorized approver must complete the request.'
          );
        } else if (progress) {
          setMsg(
            `Product line issued. ${progress.fulfilled} of ${progress.total} lines fulfilled.`
          );
        }
      } else {
        setMsg(
          lines.length > 1
            ? `Goods issue saved (${lines.length} products). Kept Open until delivery / RTO is marked.`
            : 'Goods issue saved and kept Open until delivery / RTO is marked.'
        );
      }

      setFormOpen(false);
      if (fulfillingId) setMode('requests');
      setFulfillingId('');
      setFulfillingLineId('');
      setFulfillingLineIndex(null);
      loadRows();
      loadRequests();
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
        Outward goods issue stays Open after save until AWB delivery is marked Delivered, RTO, or
        Closed.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

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
      </div>

      {mode === 'manual' && (
        <>
          <div className="inv-toolbar logistics-toolbar">
            <input
              className="esign-search inv-search"
              placeholder="Search TXN, product, recipient, AWB…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRows()}
            />
            <AdaptiveSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Goods issue status filter"
            >
              <option value="Open">Open</option>
              <option value="Delivered">Delivered</option>
              <option value="RTO">RTO</option>
              <option value="Closed">Closed</option>
              <option value="All">All</option>
            </AdaptiveSelect>
            <button className="btn secondary" type="button" onClick={loadRows}>
              Search
            </button>
            {canWrite && (
              <button
                className="btn"
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
            )}
            <Link className="btn secondary" to="/asset-requests?type=LOGISTICS">
              Create goods issue request
            </Link>
          </div>

          {canWrite && formOpen && (
            <form className="card logistics-form logistics-txn-form" onSubmit={save}>
              <h3>{fulfillingId ? 'Goods issue from request' : 'Manual goods issue'}</h3>

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
                    <Field label="Preferred date">
                      <input
                        type="date"
                        value={form.preferredDate || ''}
                        onChange={(e) => setField('preferredDate', e.target.value)}
                      />
                    </Field>
                    <Field label="Delivery mode" required>
                      <AdaptiveSelect
                        required
                        value={form.deliveryMode}
                        onChange={(e) => setField('deliveryMode', e.target.value)}
                      >
                        <option value="">Select</option>
                        {deliveryModes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                    {needsAwb && (
                      <Field label="AWB number" required>
                        <input
                          required
                          value={form.awbNumber}
                          onChange={(e) => setField('awbNumber', e.target.value)}
                        />
                      </Field>
                    )}
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
                                <input
                                  required
                                  disabled={form.logisticsProductsConfirmed}
                                  value={item.serialNumber || ''}
                                  onChange={(event) =>
                                    updateIssueProduct(index, {
                                      serialNumber: event.target.value,
                                    })
                                  }
                                  placeholder="Device serial"
                                />
                              </div>
                            )}
                            {showBatch && (
                              <div className="field">
                                <label>Batch number *</label>
                                <input
                                  required
                                  disabled={form.logisticsProductsConfirmed}
                                  value={item.batchNumber || ''}
                                  onChange={(event) =>
                                    updateIssueProduct(index, {
                                      batchNumber: event.target.value,
                                    })
                                  }
                                  placeholder="Batch"
                                />
                              </div>
                            )}
                            {expiryApplicable && (
                              <div className="field">
                                <label>Expiry date *</label>
                                <input
                                  required
                                  type="date"
                                  disabled={form.logisticsProductsConfirmed}
                                  value={item.expiryDate || ''}
                                  onChange={(event) =>
                                    updateIssueProduct(index, {
                                      expiryDate: event.target.value,
                                    })
                                  }
                                />
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
                      {showFrom && (
                        <DirectoryPartyFields
                          label="Sender"
                          prefix="from"
                          contacts={contacts}
                          form={form}
                          setForm={setForm}
                        />
                      )}
                      {showTo && (
                        <DirectoryPartyFields
                          label="Send to / Recipient"
                          prefix="to"
                          contacts={contacts}
                          form={form}
                          setForm={setForm}
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="logistics-form-grid logistics-form-grid--inout">
                    <Field label="Issue kind">
                      <input readOnly value={normalizeIssueKind(form.logisticsKind)} />
                    </Field>
                    <Field label="Product category" required>
                      <AdaptiveSelect
                        required
                        disabled
                        value={form.productType}
                        onChange={(e) => onProductCategoryChange(e.target.value)}
                      >
                        {productTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                    <Field label="Model/Variant/Name" required>
                      <AdaptiveSelect
                        required
                        disabled
                        value={form.productId}
                        onChange={(e) => pickProduct(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {productsForType.map((p) => (
                          <option key={p._id} value={p._id}>
                            {productLabel(p)}
                            {p.code ? ` (${p.code})` : ''}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                    <Field label="Qty" required>
                      <input type="number" required disabled value={form.qty} readOnly />
                    </Field>
                    {lineNeedsSerial(form.trackingKind) && (
                      <Field label="Serial number" required>
                        <input
                          required
                          value={form.serialNumber || ''}
                          onChange={(e) => setField('serialNumber', e.target.value)}
                          placeholder="Device serial"
                        />
                      </Field>
                    )}
                    {lineNeedsBatch(form.trackingKind) && (
                      <Field label="Batch number" required>
                        <input
                          required
                          value={form.batchNumber || ''}
                          onChange={(e) => setField('batchNumber', e.target.value)}
                          placeholder="Batch"
                        />
                      </Field>
                    )}
                    {form.expiryApplicable && (
                      <Field label="Expiry date" required>
                        <input
                          required
                          type="date"
                          value={form.expiryDate || ''}
                          onChange={(e) => setField('expiryDate', e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                  {showFrom && (
                    <DirectoryPartyFields
                      label="Sender"
                      prefix="from"
                      contacts={contacts}
                      form={form}
                      setForm={setForm}
                    />
                  )}
                  {showTo && (
                    <DirectoryPartyFields
                      label="Send to / Recipient"
                      prefix="to"
                      contacts={contacts}
                      form={form}
                      setForm={setForm}
                    />
                  )}
                  <div className="logistics-form-grid logistics-form-grid--inout">
                    <Field label="Delivery mode" required>
                      <AdaptiveSelect
                        required
                        value={form.deliveryMode}
                        onChange={(e) => setField('deliveryMode', e.target.value)}
                      >
                        {deliveryModes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </Field>
                    {needsAwb && (
                      <Field label="AWB number" required>
                        <input
                          required
                          value={form.awbNumber}
                          onChange={(e) => setField('awbNumber', e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                </>
              )}

              <div className="logistics-form-actions">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save goods issue'}
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
                        {String(r.transactionDate || r.transactionDateTime || '').slice(0, 10)}
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
                      <td>{r.deliveryMode || r.mode || '-'}</td>
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
                      <td>
                        {canWrite && open ? (
                          <div className="ilog-attach-cell">
                            <button
                              type="button"
                              className="btn secondary"
                              disabled={deliveryBusyId === r._id}
                              onClick={() => markDelivery(r, 'Delivered')}
                            >
                              {deliveryBusyId === r._id ? '…' : 'Mark Delivered'}
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              disabled={deliveryBusyId === r._id}
                              onClick={() => markDelivery(r, 'RTO')}
                            >
                              Mark RTO
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              disabled={deliveryBusyId === r._id}
                              onClick={() => markDelivery(r, 'Closed')}
                            >
                              Close
                            </button>
                          </div>
                        ) : (
                          <span className="muted">
                            {r.deliveryOutcome || ds}
                            {r.closedAt ? ` · ${String(r.closedAt).slice(0, 10)}` : ''}
                          </span>
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
        </>
      )}

      {mode === 'requests' && (
        <>
          <div className="inv-toolbar logistics-toolbar">
            <button className="btn secondary" type="button" onClick={loadRequests}>
              Refresh
            </button>
            <Link className="btn" to="/asset-requests?type=LOGISTICS">
              + New goods issue request
            </Link>
          </div>
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
                {requests.map((r) => {
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
                          </span>
                        </div>
                      ))}
                      <div className="muted mono-sm">
                        {progress.fulfilled}/{progress.total} lines issued
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
                              {fulfilled ? `Line ${index + 1} issued` : `Issue line ${index + 1}`}
                            </button>
                          );
                        })}
                    </td>
                  </tr>
                  );
                })}
                {!requests.length && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No open goods issue requests. Create one in Request One.
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
