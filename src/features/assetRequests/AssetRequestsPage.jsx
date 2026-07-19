import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';
import { FIELD, MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { FALLBACK_PRODUCT } from '../logistics/logisticsTxnShared.jsx';
import { isApprovalOverdue } from '../../shared/approvalTiming.js';
import { isVendorContact } from '../agreements/contactPicklists.js';
import {
  MASTER_MODULES,
  entitiesForModule,
  getMasterEntity,
  emptyMasterPayload,
  validateMasterPayload,
} from '../masters/masterCatalog.js';

const REQUEST_TYPES = [
  { value: 'SERVICE', label: 'Repair & Maintenance', needsAsset: true },
  { value: 'LOGISTICS', label: 'Goods Issue', needsAsset: true },
  { value: 'TRAINING', label: 'Training', needsAsset: false },
  { value: 'REIMBURSEMENT', label: 'Reimbursement', needsAsset: false },
  { value: 'HIRING', label: 'Hiring', needsAsset: false },
  { value: 'MASTER_ADD', label: 'Master One Request', needsAsset: false },
  { value: 'OTHER', label: 'Others', needsAsset: false },
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const SERVICE_TYPES = ['Hardware', 'Software', 'Calibration', 'Power', 'Cosmetic', 'Maintenance'];
const LOGISTICS_KINDS = ['Fresh Dispatch', 'Inter Transfer', 'Recall / Pickup'];
const TRANSPORT_MODES = [
  'Hand Delivery',
  'Regular Courier',
  'Apex',
  'Porter',
  'Other',
  'Blue Dart',
  'DTDC',
  'Other Courier',
];
const TRAINING_TYPES = [
  'Fresh Training',
  'Refresher Device',
  'Refresher Non Device',
  'L1 Troubleshooting',
  'FTE onboarding',
];
const TRAINING_MODES = ['Virtual', 'Physical'];
const HIRING_TYPES = ['Full Timer', 'Freelancer'];
const HCW_TYPES = ['Phlebotomist', 'Technician', 'Dietitian', 'Physio', 'Others'];
const CAMP_TYPES = ['No Device', 'Light Device (1-5 KG)', 'Heavy Device (5-12 KG)'];
const HIRING_METHODS = ['BMD', 'Diagnostics', 'Uroflow', 'Dietitian', 'Others'];
const OTHER_REQUEST_OPTIONS = {
  'Asset Request': ['New Asset', 'Asset Replacement', 'Asset Return', 'Asset Transfer'],
  'Document Request': [
    'Agreement / Contract',
    'Official Letter (Employment, Salary, Experience)',
    'Certificate / ID Document',
  ],
  'Procurement Request': [
    'Office Supplies',
    'Device & Equipment Purchase',
    'Consumables / Miscellaneous',
  ],
  'IT Support': [
    'Hardware Support',
    'Software Support',
    'Network & Email Support',
    'Password / Account Issues',
  ],
  'Access Request': [
    'Application Access',
    'Role & Permission Change',
    'New User / Account Creation',
    'Access Removal',
  ],
  'Facility Request': [
    'Housekeeping',
    'Electrical / Plumbing',
    'Furniture & Workspace',
    'Meeting Room / Office Facilities',
  ],
};
const ASSET_PRODUCT_TYPES = new Set(['Medical Device', 'Non-Medical Device']);

function todayLocal() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function emptyLogisticsProduct() {
  return { productType: '', productId: '', productName: '', qty: '1' };
}

const EMPTY_FORM = {
  requestType: 'SERVICE',
  serviceType: 'Hardware',
  assetId: '',
  assetName: '',
  assetCustody: '',
  custodianState: '',
  custodianName: '',
  custodianContact: '',
  custodianCity: '',
  contactId: '',
  reason: '',
  priority: 'Medium',
  issueCategory: '',
  maintenanceKind: '',
  logisticsKind: '',
  logisticsProducts: [emptyLogisticsProduct()],
  logisticsProductsConfirmed: false,
  preferredVendorContactId: '',
  preferredVendor: '',
  serviceProvider: '',
  expectedDate: '',
  scheduledDate: '',
  preferredDate: '',
  logisticsPreferredDate: todayLocal(),
  fromContactId: '',
  fromState: '',
  fromCity: '',
  fromName: '',
  fromNumber: '',
  fromPinCode: '',
  fromAddress: '',
  toContactId: '',
  toState: '',
  toCity: '',
  toName: '',
  toNumber: '',
  toPinCode: '',
  toAddress: '',
  transportMode: '',
  trainingTopic: '',
  trainingMode: '',
  traineeContactId: '',
  traineeName: '',
  venue: '',
  amount: '',
  currency: 'INR',
  expenseCategory: '',
  payeeName: '',
  expenseDate: '',
  hiringType: '',
  hcwType: '',
  campType: '',
  hiringMethod: '',
  engagementDateTime: '',
  hiringAddress: '',
  hiringState: '',
  hiringCity: '',
  hiringName: '',
  hiringPinCode: '',
  budgetMin: '',
  budgetMax: '',
  otherCategory: '',
  otherSubcategory: '',
  masterModule: 'inventory',
  masterEntity: 'products',
  masterPayload: emptyMasterPayload('products'),
};

function contactRefId(asset) {
  const raw = asset?.contactId || asset?.hcwId;
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw._id || raw.id || '');
  return String(raw);
}

function snapshotFromAsset(asset, contactsById) {
  const cid = contactRefId(asset);
  const contact = cid ? contactsById.get(cid) : null;
  return {
    assetId: asset?._id ? String(asset._id) : '',
    assetName: asset?.deviceNameSnapshot || asset?.name || '',
    assetCustody: asset?.custody || '',
    custodianState: asset?.custodianState || asset?.location?.state || contact?.state || '',
    custodianName: asset?.custodianName || contact?.name || '',
    custodianContact: asset?.custodianContact || contact?.contact || contact?.mobile || '',
    custodianCity: asset?.custodianCity || asset?.location?.city || contact?.city || '',
    contactId: cid || '',
  };
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function contactNumber(contact) {
  return contact?.contact || contact?.mobile || '';
}

function contactSnapshot(contact, prefix) {
  return {
    [`${prefix}ContactId`]: contact?._id ? String(contact._id) : '',
    [`${prefix}State`]: contact?.state || '',
    [`${prefix}City`]: contact?.city || '',
    [`${prefix}Name`]: contact?.name || '',
    [`${prefix}Number`]: contactNumber(contact),
    [`${prefix}PinCode`]: contact?.pinCode || '',
    [`${prefix}Address`]: contact?.address || '',
  };
}

function DirectionContactFields({ label, prefix, contacts, form, setForm }) {
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
      ...(contact
        ? contactSnapshot(contact, prefix)
        : {
            [idKey]: '',
            [`${prefix}State`]: '',
            [`${prefix}City`]: '',
            [`${prefix}Name`]: '',
            [`${prefix}Number`]: '',
            [`${prefix}PinCode`]: '',
            [`${prefix}Address`]: '',
          }),
    }));
  };

  const selectField = (fieldIndex, selected) => {
    const field = fields[fieldIndex];
    const candidates = matchingBefore(fieldIndex).filter(
      (contact) => String(field.value(contact)) === String(selected)
    );
    if (candidates.length === 1) {
      setForm((prev) => ({ ...prev, ...contactSnapshot(candidates[0], prefix) }));
      return;
    }
    const changes = { [idKey]: '', [`${prefix}${field.suffix}`]: selected };
    fields.slice(fieldIndex + 1).forEach(({ suffix }) => {
      changes[`${prefix}${suffix}`] = '';
    });
    setForm((prev) => ({ ...prev, ...changes }));
  };

  return (
    <fieldset className="arq-contact-group arq-span">
      <legend>{label}</legend>
      <div className="arq-contact-grid">
        <div className="field">
          <label>Contact Directory *</label>
          <AdaptiveSelect required value={form[idKey]} onChange={(e) => selectContact(e.target.value)}>
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
                value={form[`${prefix}${field.suffix}`]}
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

function typeMeta(value) {
  return REQUEST_TYPES.find((t) => t.value === value) || REQUEST_TYPES[0];
}

function displayType(t) {
  if (t === 'MOVEMENT' || t === 'LOGISTICS') return 'Goods Issue';
  if (t === 'REPAIR' || t === 'MAINTENANCE') return 'Repair & Maintenance';
  return REQUEST_TYPES.find((x) => x.value === t)?.label || t;
}

function productOptionLabel(p) {
  const name = p?.model || p?.partNumber || p?.name || p?.productName || '';
  return name ? (p.code ? `${name} (${p.code})` : name) : p?._id || '';
}

function normalizeLogisticsKind(raw) {
  const v = String(raw || '').trim();
  if (v === 'Goods Issue' || v === 'Dispatch' || v === 'Delivery') return 'Fresh Dispatch';
  return v;
}

function isFreshDispatchKind(kind) {
  const k = normalizeLogisticsKind(kind);
  return k === 'Fresh Dispatch';
}

function detailSummary(r) {
  const logisticsProducts = Array.isArray(r.logisticsProducts) ? r.logisticsProducts : [];
  const productSummary = logisticsProducts.length
    ? `${logisticsProducts
        .slice(0, 2)
        .map((item) => `${item.productName || item.productType || 'Product'} ×${item.qty || 0}`)
        .join(', ')}${logisticsProducts.length > 2 ? ` +${logisticsProducts.length - 2} more` : ''}`
    : '';
  const bits = [
    r.requestType === 'REPAIR'
      ? 'Repair'
      : r.requestType === 'MAINTENANCE'
        ? 'Maintenance'
        : '',
    r.priority,
    r.issueCategory ||
      r.maintenanceKind ||
      normalizeLogisticsKind(r.logisticsKind) ||
      r.expenseCategory ||
      r.otherCategory,
    r.otherSubcategory,
    r.trainingTopic,
    r.traineeName,
    r.hiringType,
    r.hcwType,
    r.campType,
    r.hiringMethod,
    r.requestType === 'MASTER_ADD'
      ? `${r.masterModule || ''} · ${getMasterEntity(r.masterEntity)?.label || r.masterEntity || ''}`
      : '',
    r.createdMasterCode ? `Created ${r.createdMasterCode}` : '',
    productSummary,
    r.amount != null && r.amount !== '' ? `${r.currency || 'INR'} ${r.amount}` : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

export default function AssetRequestsPage() {
  const { can, user } = useAuth();
  const { options: transportModeOptions } = usePicklistOptions(
    'logistics.deliveryMode',
    TRANSPORT_MODES
  );
  const { options: hcwTypeOptions } = usePicklistOptions('hiring.hcwType', HCW_TYPES);
  const { options: hiringMethodOptions } = usePicklistOptions('hiring.method', HIRING_METHODS);
  const [searchParams] = useSearchParams();
  const canRequest =
    can('asset-requests:request') ||
    can('movements:request') ||
    can('repairs:write') ||
    can('maintenance:write') ||
    can('*');
  const canApprove =
    can('asset-requests:approve') || can('movements:approve') || can('*');

  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [logisticsMeta, setLogisticsMeta] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [productPhoto, setProductPhoto] = useState(null);
  const [reimbursementBill, setReimbursementBill] = useState(null);
  const [otherAttachment, setOtherAttachment] = useState(null);
  const [generatedLinks, setGeneratedLinks] = useState({});
  const [linkBusyId, setLinkBusyId] = useState('');
  const productPhotoRef = useRef(null);
  const reimbursementBillRef = useRef(null);
  const otherAttachmentRef = useRef(null);

  useEffect(() => {
    const raw = String(searchParams.get('type') || '').toUpperCase();
    if (!raw) return;
    const isService = raw === 'REPAIR' || raw === 'MAINTENANCE' || raw === 'SERVICE';
    const allowed = isService || REQUEST_TYPES.some((t) => t.value === raw);
    if (!allowed) return;
    setForm((prev) => ({
      ...prev,
      requestType: isService ? 'SERVICE' : raw,
      serviceType: raw === 'MAINTENANCE' ? 'Maintenance' : prev.serviceType,
    }));
    setTypeFilter(isService ? 'SERVICE' : raw);
  }, [searchParams]);

  const contactsById = useMemo(() => {
    const map = new Map();
    for (const c of contacts) map.set(String(c._id), c);
    return map;
  }, [contacts]);
  const vendorContacts = useMemo(
    () => contacts.filter((contact) => isVendorContact(contact)),
    [contacts]
  );
  const logisticsConfig = logisticsMeta?.inOut || {};
  const logisticsProductTypes = logisticsConfig.productTypes || FALLBACK_PRODUCT;
  const logisticsProducts = logisticsMeta?.products || [];
  const expenseCategories = logisticsMeta?.expenseCategories || [];

  const custodyOptions = useMemo(
    () => uniqueSorted(assets.map((a) => a.custody)),
    [assets]
  );
  const assetNameOptions = useMemo(
    () =>
      assets.map((a) => ({
        id: String(a._id),
        label: a.deviceNameSnapshot || a.assetTag || a.serialNumber || String(a._id),
        serial: a.serialNumber || '',
      })),
    [assets]
  );
  const custodianNameOptions = useMemo(
    () =>
      uniqueSorted([
        ...assets.map((a) => a.custodianName || a.contactId?.name),
        ...contacts.map((c) => c.name),
      ]),
    [assets, contacts]
  );
  const sourceCustodianOptions = useMemo(
    () =>
      uniqueSorted(
        assets
          .filter(
            (asset) =>
              !form.assetCustody || String(asset.custody || '') === String(form.assetCustody)
          )
          .map((asset) => asset.custodianName || asset.contactId?.name)
      ),
    [assets, form.assetCustody]
  );

  const logisticsNeedsAsset =
    form.requestType === 'LOGISTICS' &&
    form.logisticsProducts.some((item) => ASSET_PRODUCT_TYPES.has(item.productType));
  const needsAsset =
    form.requestType === 'LOGISTICS' ? logisticsNeedsAsset : typeMeta(form.requestType).needsAsset;
  const filteredRows = rows;

  const load = () => {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (typeFilter) params.set('requestType', typeFilter);
    api(`/asset-requests?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setListMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    load();
    api('/assets?limit=200')
      .then((r) => setAssets(r.data || []))
      .catch(() => {});
    api('/contacts?limit=200')
      .then((r) => setContacts(r.data || []))
      .catch(() => {});
    api('/logistics/meta')
      .then((r) => setLogisticsMeta(r.data || null))
      .catch(() => setLogisticsMeta(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter]);

  const applyLinked = (partial) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const linkFromAssetId = (assetId) => {
    const asset = assets.find((a) => String(a._id) === String(assetId));
    if (!asset) {
      applyLinked({ assetId });
      return;
    }
    applyLinked(snapshotFromAsset(asset, contactsById));
  };

  const linkFromCustody = (custody) => {
    const matches = assets.filter((a) => String(a.custody || '') === String(custody));
    if (matches.length === 1) {
      applyLinked(snapshotFromAsset(matches[0], contactsById));
      return;
    }
    applyLinked({
      assetCustody: custody,
      assetId: matches.some((a) => String(a._id) === form.assetId) ? form.assetId : '',
      assetName: '',
    });
  };

  const linkFromCustodianName = (name) => {
    const assetMatch = assets.filter(
      (a) => String(a.custodianName || a.contactId?.name || '') === String(name)
    );
    if (assetMatch.length === 1) {
      applyLinked(snapshotFromAsset(assetMatch[0], contactsById));
      return;
    }
    const contact = contacts.find((c) => String(c.name || '') === String(name));
    if (contact) {
      const assetForContact = assets.find((a) => contactRefId(a) === String(contact._id));
      if (assetForContact) {
        applyLinked(snapshotFromAsset(assetForContact, contactsById));
        return;
      }
      applyLinked({
        custodianName: contact.name || '',
        custodianContact: contact.contact || contact.mobile || '',
        custodianCity: contact.city || '',
        custodianState: contact.state || '',
        contactId: String(contact._id),
      });
      return;
    }
    applyLinked({ custodianName: name });
  };

  const setType = (requestType) => {
    if (requestType !== 'REIMBURSEMENT') {
      setReimbursementBill(null);
      if (reimbursementBillRef.current) reimbursementBillRef.current.value = '';
    }
    if (requestType !== 'OTHER' && requestType !== 'MASTER_ADD') {
      setOtherAttachment(null);
      if (otherAttachmentRef.current) otherAttachmentRef.current.value = '';
    }
    const defaultEntity =
      requestType === 'MASTER_ADD' ? entitiesForModule('inventory')[0]?.id || 'products' : '';
    setForm((prev) => ({
      ...prev,
      requestType,
      ...(['TRAINING', 'REIMBURSEMENT', 'HIRING', 'OTHER', 'MASTER_ADD'].includes(requestType)
        ? {
            assetId: '',
            assetName: '',
            assetCustody: '',
            custodianState: '',
            custodianName: '',
            custodianContact: '',
            custodianCity: '',
            contactId: '',
          }
        : {}),
      ...(['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(requestType)
        ? { reason: '' }
        : {}),
      ...(requestType === 'MASTER_ADD'
        ? {
            masterModule: 'inventory',
            masterEntity: defaultEntity,
            masterPayload: emptyMasterPayload(defaultEntity),
          }
        : {}),
      logisticsProductsConfirmed:
        requestType === 'LOGISTICS' ? prev.logisticsProductsConfirmed : false,
    }));
  };

  const updateLogisticsProduct = (index, changes) => {
    setForm((prev) => ({
      ...prev,
      logisticsProductsConfirmed: false,
      logisticsProducts: prev.logisticsProducts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      ),
    }));
  };

  const selectLogisticsProduct = (index, productId) => {
    const duplicate = form.logisticsProducts.some(
      (item, itemIndex) =>
        itemIndex !== index && productId && String(item.productId) === String(productId)
    );
    if (duplicate) {
      setError('The same product cannot be added more than once.');
      return;
    }
    setError('');
    const product = logisticsProducts.find((item) => String(item._id) === String(productId));
    updateLogisticsProduct(
      index,
      product
        ? {
            productId: String(product._id),
            productName: productOptionLabel(product) || product.name || product.productName || '',
            productType: product.productType || form.logisticsProducts[index].productType,
          }
        : { productId: '', productName: '' }
    );
  };

  const addLogisticsProduct = () => {
    setForm((prev) => ({
      ...prev,
      logisticsProductsConfirmed: false,
      logisticsProducts: [...prev.logisticsProducts, emptyLogisticsProduct()],
    }));
  };

  const removeLogisticsProduct = (index) => {
    setForm((prev) => ({
      ...prev,
      logisticsProductsConfirmed: false,
      logisticsProducts:
        prev.logisticsProducts.length === 1
          ? [emptyLogisticsProduct()]
          : prev.logisticsProducts.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const confirmLogisticsProducts = () => {
    const invalid = form.logisticsProducts.some(
      (item) =>
        !item.productType ||
        !item.productId ||
        !item.productName ||
        !Number.isFinite(Number(item.qty)) ||
        Number(item.qty) <= 0
    );
    if (invalid) {
      setError('Complete every goods issue product row and enter a positive quantity.');
      return;
    }
    const productIds = form.logisticsProducts.map((item) => String(item.productId));
    if (new Set(productIds).size !== productIds.length) {
      setError('The same product cannot be added more than once.');
      return;
    }
    setError('');
    setForm((prev) => ({ ...prev, logisticsProductsConfirmed: true }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (
      form.requestType === 'TRAINING' &&
      form.trainingMode === 'Physical' &&
      (!form.traineeContactId || !form.venue)
    ) {
      setError('Physical training requires a trainee with a city in Contact Directory.');
      return;
    }
    if (needsAsset && !form.assetId) {
      setError(
        form.requestType === 'LOGISTICS'
          ? 'Select a linked asset for Medical Device or Non-Medical Device products.'
          : 'Select a linked asset for this request type.'
      );
      return;
    }
    if (
      form.requestType === 'LOGISTICS' &&
      form.logisticsProducts.some(
        (item) =>
          !item.productType ||
          !item.productId ||
          !item.productName ||
          !Number.isFinite(Number(item.qty)) ||
          Number(item.qty) <= 0
      )
    ) {
      setError('Complete every goods issue product row and enter a positive quantity.');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !form.logisticsProductsConfirmed) {
      setError('Confirm the selected products before choosing contacts and submitting.');
      return;
    }
    if (form.requestType === 'REIMBURSEMENT' && !reimbursementBill) {
      setError('Upload the expense bill before submitting the Reimbursement request.');
      return;
    }
    if (
      form.requestType === 'HIRING' &&
      Number(form.budgetMin) > Number(form.budgetMax)
    ) {
      setError('Minimum budget cannot be greater than maximum budget.');
      return;
    }
    if (form.requestType === 'MASTER_ADD') {
      const payloadErr = validateMasterPayload(form.masterEntity, form.masterPayload || {});
      if (payloadErr) {
        setError(payloadErr);
        return;
      }
      const entityMeta = getMasterEntity(form.masterEntity);
      if (entityMeta?.docxUpload && !otherAttachment) {
        setError('Upload a Word (.docx) file for the document template request.');
        return;
      }
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const persistedRequestType =
        form.requestType === 'SERVICE'
          ? form.serviceType === 'Maintenance'
            ? 'MAINTENANCE'
            : 'REPAIR'
          : form.requestType;
      const omitSource = ['TRAINING', 'REIMBURSEMENT', 'HIRING', 'OTHER', 'MASTER_ADD'].includes(
        form.requestType
      );
      const omitReason = ['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(
        form.requestType
      );
      const body = {
        requestType: persistedRequestType,
        assetId: omitSource ? undefined : form.assetId || undefined,
        assetName: omitSource ? '' : form.assetName,
        assetCustody: omitSource ? '' : form.assetCustody,
        custodianState: omitSource ? '' : form.custodianState,
        custodianName: omitSource ? '' : form.custodianName,
        custodianContact: omitSource ? '' : form.custodianContact,
        custodianCity: omitSource ? '' : form.custodianCity,
        contactId: omitSource ? undefined : form.contactId || undefined,
        reason: omitReason ? '' : form.reason,
        priority:
          ['REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(form.requestType)
            ? undefined
            : form.priority || undefined,
      };

      if (persistedRequestType === 'REPAIR') {
        body.issueCategory = form.serviceType;
        body.preferredVendorContactId = form.preferredVendorContactId || undefined;
        body.preferredVendor = form.preferredVendor || undefined;
        body.expectedDate = form.expectedDate || undefined;
      }
      if (persistedRequestType === 'MAINTENANCE') {
        body.maintenanceKind = 'Maintenance';
        body.serviceProvider = form.serviceProvider || undefined;
        body.scheduledDate = form.scheduledDate || undefined;
      }
      if (form.requestType === 'LOGISTICS') {
        body.logisticsKind = normalizeLogisticsKind(form.logisticsKind);
        body.fromContactId = form.fromContactId || undefined;
        body.fromState = form.fromState;
        body.fromCity = form.fromCity;
        body.fromName = form.fromName;
        body.fromNumber = form.fromNumber;
        body.fromPinCode = form.fromPinCode;
        body.fromAddress = form.fromAddress;
        body.toContactId = form.toContactId || undefined;
        body.toState = form.toState;
        body.toCity = form.toCity;
        body.toName = form.toName;
        body.toNumber = form.toNumber;
        body.toPinCode = form.toPinCode;
        body.toAddress = form.toAddress;
        body.transportMode = form.transportMode || undefined;
        body.preferredDate = form.logisticsPreferredDate || undefined;
        body.logisticsProducts = form.logisticsProducts.map((item) => ({
          productType: item.productType,
          productId: item.productId,
          productName: item.productName,
          qty: Number(item.qty),
        }));
      }
      if (form.requestType === 'TRAINING') {
        body.trainingTopic = form.trainingTopic;
        body.trainingMode = form.trainingMode || undefined;
        body.traineeContactId = form.traineeContactId || undefined;
        body.traineeName = form.traineeName || undefined;
        body.venue = form.venue || undefined;
        body.preferredDate = form.preferredDate || undefined;
      }
      if (form.requestType === 'REIMBURSEMENT') {
        body.amount = form.amount;
        body.currency = 'INR';
        body.expenseCategory = form.expenseCategory;
        body.expenseDate = form.expenseDate || undefined;
      }
      if (form.requestType === 'HIRING') {
        body.hiringType = form.hiringType;
        body.hcwType = form.hcwType;
        body.campType = form.campType;
        body.hiringMethod = form.hiringMethod;
        body.engagementDateTime = form.engagementDateTime;
        body.hiringAddress = form.hiringAddress;
        body.hiringState = form.hiringState;
        body.hiringCity = form.hiringCity;
        body.hiringName = form.hiringName;
        body.hiringPinCode = form.hiringPinCode;
        body.budgetMin = Number(form.budgetMin);
        body.budgetMax = Number(form.budgetMax);
      }
      if (form.requestType === 'OTHER') {
        body.otherCategory = form.otherCategory;
        body.otherSubcategory = form.otherSubcategory;
      }
      if (form.requestType === 'MASTER_ADD') {
        body.masterModule = form.masterModule;
        body.masterEntity = form.masterEntity;
        body.masterPayload = form.masterPayload || {};
        body.reason = form.reason || `Add ${getMasterEntity(form.masterEntity)?.label || form.masterEntity} to master`;
      }

      const created = await api('/asset-requests', { method: 'POST', body });
      let savedMessage = 'Request submitted. Designated approvers have been notified.';
      if (productPhoto && (persistedRequestType === 'REPAIR' || persistedRequestType === 'MAINTENANCE')) {
        try {
          const imageBody = new FormData();
          imageBody.append('productPhoto', productPhoto);
          await api(`/asset-requests/${created?.data?._id}/product-image`, {
            method: 'POST',
            body: imageBody,
          });
        } catch (uploadError) {
          savedMessage = `Request saved, but the product image could not be uploaded: ${uploadError.message}`;
        }
      }
      if (reimbursementBill && persistedRequestType === 'REIMBURSEMENT') {
        try {
          const billBody = new FormData();
          billBody.append('bill', reimbursementBill);
          await api(`/asset-requests/${created?.data?._id}/bill`, {
            method: 'POST',
            body: billBody,
          });
        } catch (uploadError) {
          savedMessage = `Request saved, but the bill could not be uploaded: ${uploadError.message}`;
        }
      }
      if (
        otherAttachment &&
        (persistedRequestType === 'OTHER' || persistedRequestType === 'MASTER_ADD')
      ) {
        try {
          const attachmentBody = new FormData();
          attachmentBody.append('attachment', otherAttachment);
          await api(`/asset-requests/${created?.data?._id}/attachment`, {
            method: 'POST',
            body: attachmentBody,
          });
        } catch (uploadError) {
          savedMessage = `Request saved, but the attachment could not be uploaded: ${uploadError.message}`;
        }
      }
      setForm({
        ...EMPTY_FORM,
        requestType: form.requestType,
        serviceType: form.serviceType,
        preferredDate: '',
        logisticsPreferredDate: todayLocal(),
        logisticsProducts: [emptyLogisticsProduct()],
        logisticsProductsConfirmed: false,
      });
      setProductPhoto(null);
      setReimbursementBill(null);
      setOtherAttachment(null);
      if (productPhotoRef.current) productPhotoRef.current.value = '';
      if (reimbursementBillRef.current) reimbursementBillRef.current.value = '';
      if (otherAttachmentRef.current) otherAttachmentRef.current.value = '';
      setMsg(savedMessage);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openProductImage = async (request) => {
    setError('');
    try {
      const response = await apiFetch(`/asset-requests/${request._id}/product-image`);
      if (!response.ok) throw new Error(`Could not load product image (${response.status})`);
      const blobUrl = URL.createObjectURL(await response.blob());
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const openBill = async (request) => {
    setError('');
    try {
      const response = await apiFetch(`/asset-requests/${request._id}/bill`);
      if (!response.ok) throw new Error(`Could not load bill (${response.status})`);
      const blobUrl = URL.createObjectURL(await response.blob());
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const openRequestAttachment = async (request) => {
    setError('');
    try {
      const response = await apiFetch(`/asset-requests/${request._id}/attachment`);
      if (!response.ok) throw new Error(`Could not load attachment (${response.status})`);
      const blobUrl = URL.createObjectURL(await response.blob());
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const generateImageLink = async (request) => {
    setError('');
    setMsg('');
    setLinkBusyId(request._id);
    try {
      const { data } = await api(`/asset-requests/${request._id}/product-image-link`, {
        method: 'POST',
        body: {},
      });
      const token = data?.token || data?.accessToken;
      if (!token) throw new Error('The server did not return an upload token');
      const link = `${window.location.origin}/request-upload/${encodeURIComponent(token)}`;
      setGeneratedLinks((prev) => ({ ...prev, [request._id]: link }));
      try {
        await navigator.clipboard.writeText(link);
        setMsg(`Product image link copied for ${request.requestNumber}.`);
      } catch {
        setMsg(`Product image link created for ${request.requestNumber}. Copy it from the row below.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkBusyId('');
    }
  };

  const act = async (id, action) => {
    setError('');
    try {
      await api(`/asset-requests/${id}/${action}`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelRequest = async (request) => {
    if (!window.confirm(`Cancel request ${request.requestNumber || request._id}?`)) return;
    setError('');
    setMsg('');
    try {
      await api(`/asset-requests/${request._id}/cancel`, { method: 'POST', body: {} });
      setMsg(`Request ${request.requestNumber || request._id} cancelled.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/asset-requests/export', 'Request_Center.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'REQUESTED').length;

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ASSET_REQUESTS }]}
      title={MODULE.ASSET_REQUESTS}
      description="Submit repair, maintenance, logistics, training, reimbursement, hiring, and other requests."
      actions={
        <button className="btn secondary" type="button" disabled={exportBusy} onClick={downloadMaster}>
          {exportBusy ? 'Downloading…' : 'Download Excel'}
        </button>
      }
      kpis={[
        { label: 'Total requests', value: rows.length },
        { label: 'Pending approval', value: pending },
      ]}
    >
      {error && <p className="error">{error}</p>}
      {msg && <p className="rp-toast">{msg}</p>}

      {canRequest && (
        <form className="card arq-form" onSubmit={submit}>
          <h3>New request</h3>
          <div className="arq-grid">
            <div className="field">
              <label>Request Type *</label>
              <AdaptiveSelect required value={form.requestType} onChange={(e) => setType(e.target.value)}>
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>

            {form.requestType === 'SERVICE' && (
              <div className="field">
                <label>Service type *</label>
                <AdaptiveSelect
                  required
                  value={form.serviceType}
                  onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
            )}

            {!['REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(form.requestType) && (
              <div className="field">
                <label>Priority</label>
                <AdaptiveSelect
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
            )}

            {/* -- Repair -- */}
            {form.requestType === 'SERVICE' && form.serviceType !== 'Maintenance' && (
              <>
                <div className="field">
                  <label>Preferred vendor</label>
                  <AdaptiveSelect
                    value={form.preferredVendorContactId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const vendor = contactsById.get(id);
                      setForm((prev) => ({
                        ...prev,
                        preferredVendorContactId: id,
                        preferredVendor: vendor?.organization || vendor?.name || '',
                      }));
                    }}
                  >
                    <option value="">No preference</option>
                    {vendorContacts.map((vendor) => (
                      <option key={vendor._id} value={vendor._id}>
                        {vendor.organization || vendor.name}
                        {vendor.city ? `: ${vendor.city}` : ''}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Expected return date</label>
                  <input
                    type="date"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {form.requestType === 'SERVICE' && (
              <div className="field arq-span">
                <label>Product image</label>
                <FilePicker
                  ref={productPhotoRef}
                  accept="image/*"
                  onChange={(e) => setProductPhoto(e.target.files?.[0] || null)}
                />
                <span className="muted mono-sm">Optional. It uploads after the request is saved.</span>
              </div>
            )}

            {/* -- Maintenance -- */}
            {form.requestType === 'SERVICE' && form.serviceType === 'Maintenance' && (
              <>
                <div className="field">
                  <label>Service provider</label>
                  <input
                    value={form.serviceProvider}
                    onChange={(e) => setForm({ ...form, serviceProvider: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="field">
                  <label>Scheduled date</label>
                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* -- Goods Issue (aligned with Movement One manual dispatch) -- */}
            {form.requestType === 'LOGISTICS' && (
              <>
                <div className="field">
                  <label>Issue kind *</label>
                  <AdaptiveSelect
                    required
                    value={normalizeLogisticsKind(form.logisticsKind) || form.logisticsKind}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        logisticsKind: e.target.value,
                        fromContactId: '',
                        fromState: '',
                        fromCity: '',
                        fromName: '',
                        fromNumber: '',
                        fromPinCode: '',
                        fromAddress: '',
                        toContactId: '',
                        toState: '',
                        toCity: '',
                        toName: '',
                        toNumber: '',
                        toPinCode: '',
                        toAddress: '',
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {LOGISTICS_KINDS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Delivery mode *</label>
                  <OtherAwareSelect
                    required
                    picklistKey="logistics.deliveryMode"
                    source="asset-request"
                    options={transportModeOptions.length ? transportModeOptions : TRANSPORT_MODES}
                    value={form.transportMode}
                    onChange={(e) => setForm({ ...form, transportMode: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Preferred date</label>
                  <input
                    type="date"
                    value={form.logisticsPreferredDate}
                    onChange={(e) =>
                      setForm({ ...form, logisticsPreferredDate: e.target.value })
                    }
                  />
                </div>
                <fieldset className="arq-product-group arq-span">
                  <legend>Products *</legend>
                  <div className="arq-product-list">
                    {form.logisticsProducts.map((item, index) => {
                      const selectedElsewhere = new Set(
                        form.logisticsProducts
                          .filter((_, itemIndex) => itemIndex !== index)
                          .map((row) => String(row.productId))
                          .filter(Boolean)
                      );
                      const matchingProducts = logisticsProducts.filter(
                        (product) =>
                          (!item.productType || product.productType === item.productType) &&
                          !selectedElsewhere.has(String(product._id))
                      );
                      return (
                        <div className="arq-product-row" key={`logistics-product-${index}`}>
                          <div className="field">
                            <label>Product category *</label>
                            <AdaptiveSelect
                              required
                              value={item.productType}
                              disabled={form.logisticsProductsConfirmed}
                              onChange={(event) =>
                                updateLogisticsProduct(index, {
                                  productType: event.target.value,
                                  productId: '',
                                  productName: '',
                                })
                              }
                            >
                              <option value="">Select category</option>
                              {logisticsProductTypes.map((productType) => (
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
                                selectLogisticsProduct(index, event.target.value)
                              }
                            >
                              <option value="">
                                {item.productType
                                  ? 'Select model / variant / name'
                                  : 'Select category first'}
                              </option>
                              {matchingProducts.map((product) => (
                                <option key={product._id} value={product._id}>
                                  {productOptionLabel(product)}
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
                                updateLogisticsProduct(index, { qty: event.target.value })
                              }
                            />
                          </div>
                          <button
                            className="btn secondary btn-compact arq-product-remove"
                            type="button"
                            disabled={form.logisticsProductsConfirmed}
                            onClick={() => removeLogisticsProduct(index)}
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
                    onClick={addLogisticsProduct}
                  >
                    + Add product
                  </button>
                  <button
                    className="btn btn-compact"
                    type="button"
                    onClick={() =>
                      form.logisticsProductsConfirmed
                        ? setForm((prev) => ({ ...prev, logisticsProductsConfirmed: false }))
                        : confirmLogisticsProducts()
                    }
                  >
                    {form.logisticsProductsConfirmed ? 'Change products' : 'Confirm products'}
                  </button>
                </fieldset>
                {form.logisticsProductsConfirmed &&
                  (form.logisticsKind === 'Inter Transfer' ||
                    form.logisticsKind === 'Recall / Pickup') && (
                  <DirectionContactFields
                    label="Sender"
                    prefix="from"
                    contacts={contacts}
                    form={form}
                    setForm={setForm}
                  />
                )}
                {form.logisticsProductsConfirmed &&
                  (form.logisticsKind === 'Inter Transfer' ||
                    form.logisticsKind === 'Recall / Pickup' ||
                    isFreshDispatchKind(form.logisticsKind)) && (
                  <DirectionContactFields
                    label="Send to / Recipient"
                    prefix="to"
                    contacts={contacts}
                    form={form}
                    setForm={setForm}
                  />
                )}
              </>
            )}

            {/* -- Training -- */}
            {form.requestType === 'TRAINING' && (
              <>
                <div className="field">
                  <label>Training type *</label>
                  <AdaptiveSelect
                    required
                    value={form.trainingTopic}
                    onChange={(e) => setForm({ ...form, trainingTopic: e.target.value })}
                  >
                    <option value="">Select training type</option>
                    {TRAINING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Mode</label>
                  <AdaptiveSelect
                    value={form.trainingMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      const trainee = contactsById.get(form.traineeContactId);
                      setForm((prev) => ({
                        ...prev,
                        trainingMode: mode,
                        venue: mode === 'Physical' ? trainee?.city || '' : '',
                      }));
                    }}
                  >
                    <option value="">Select</option>
                    {TRAINING_MODES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>
                    Trainee name
                    {form.trainingMode === 'Physical' ? ' *' : ''}
                  </label>
                  <AdaptiveSelect
                    required={form.trainingMode === 'Physical'}
                    value={form.traineeContactId}
                    onChange={(e) => {
                      const trainee = contactsById.get(e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        traineeContactId: e.target.value,
                        traineeName: trainee?.name || '',
                        venue: prev.trainingMode === 'Physical' ? trainee?.city || '' : '',
                      }));
                    }}
                  >
                    <option value="">Select from Contact Directory</option>
                    {contacts.map((contact) => (
                      <option key={contact._id} value={contact._id}>
                        {contact.name || 'Unnamed'}
                        {contact.city ? `: ${contact.city}` : ''}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                {form.trainingMode === 'Physical' && (
                  <div className="field">
                    <label>Location (Trainee city)</label>
                    <input
                      readOnly
                      value={form.venue}
                      placeholder="Select a trainee with a city in Contact Directory"
                    />
                  </div>
                )}
                <div className="field">
                  <label>Preferred date</label>
                  <input
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* -- Reimbursement -- */}
            {form.requestType === 'REIMBURSEMENT' && (
              <>
                <div className="field">
                  <label>Expense date *</label>
                  <input
                    required
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Expense category *</label>
                  <AdaptiveSelect
                    required
                    value={form.expenseCategory}
                    onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })}
                  >
                    <option value="">Select from Expense Categories Master</option>
                    {expenseCategories.map((category) => (
                      <option key={category._id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </AdaptiveSelect>
                  {(() => {
                    const selected = expenseCategories.find((c) => c.name === form.expenseCategory);
                    if (!selected?.covers) return null;
                    return (
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
                        Covers: {selected.covers}
                      </p>
                    );
                  })()}
                </div>
                <div className="field">
                  <label>Expense amount (INR) *</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Bill *</label>
                  <FilePicker
                    ref={reimbursementBillRef}
                    required
                    accept="image/*,.pdf"
                    onChange={(e) => setReimbursementBill(e.target.files?.[0] || null)}
                  />
                  <span className="muted mono-sm">Upload an image or PDF.</span>
                </div>
              </>
            )}

            {/* -- Hiring -- */}
            {form.requestType === 'HIRING' && (
              <>
                <div className="field">
                  <label>Hiring type *</label>
                  <AdaptiveSelect
                    required
                    value={form.hiringType}
                    onChange={(e) => setForm({ ...form, hiringType: e.target.value })}
                  >
                    <option value="">Select hiring type</option>
                    {HIRING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>HCW type *</label>
                  <OtherAwareSelect
                    required
                    picklistKey="hiring.hcwType"
                    otherLabel="Others"
                    source="asset-request-hiring"
                    options={hcwTypeOptions.length ? hcwTypeOptions : HCW_TYPES}
                    value={form.hcwType}
                    onChange={(e) => setForm({ ...form, hcwType: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Camp type *</label>
                  <AdaptiveSelect
                    required
                    value={form.campType}
                    onChange={(e) => setForm({ ...form, campType: e.target.value })}
                  >
                    <option value="">Select camp type</option>
                    {CAMP_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Method *</label>
                  <OtherAwareSelect
                    required
                    picklistKey="hiring.method"
                    otherLabel="Others"
                    source="asset-request-hiring"
                    options={hiringMethodOptions.length ? hiringMethodOptions : HIRING_METHODS}
                    value={form.hiringMethod}
                    onChange={(e) => setForm({ ...form, hiringMethod: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Engagement date &amp; time *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.engagementDateTime}
                    onChange={(e) =>
                      setForm({ ...form, engagementDateTime: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Name *</label>
                  <input
                    required
                    value={form.hiringName}
                    onChange={(e) => setForm({ ...form, hiringName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Address *</label>
                  <input
                    required
                    value={form.hiringAddress}
                    onChange={(e) => setForm({ ...form, hiringAddress: e.target.value })}
                  />
                </div>
                <LocationCascade
                  required
                  pinRequired
                  value={{
                    state: form.hiringState,
                    city: form.hiringCity,
                    district: form.hiringDistrict || '',
                    pinCode: form.hiringPinCode || '',
                    stateId: form.hiringStateId || '',
                    districtId: form.hiringDistrictId || '',
                    cityId: form.hiringCityId || '',
                  }}
                  onChange={(loc) =>
                    setForm({
                      ...form,
                      hiringState: loc.state || '',
                      hiringCity: loc.city || '',
                      hiringDistrict: loc.district || '',
                      hiringPinCode: loc.pinCode || '',
                      hiringStateId: loc.stateId || '',
                      hiringDistrictId: loc.districtId || '',
                      hiringCityId: loc.cityId || '',
                    })
                  }
                />
                <div className="field">
                  <label>Budget minimum (₹) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.budgetMin}
                    onChange={(e) => setForm({ ...form, budgetMin: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Budget maximum (₹) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.budgetMax}
                    onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* -- Master One Request -- */}
            {form.requestType === 'MASTER_ADD' && (
              <>
                <div className="field arq-span">
                  <h4 className="arq-section-title">Master One Request</h4>
                  <p className="muted" style={{ margin: '0 0 8px' }}>
                    Choose the module and reference type. On approval the record is created in Master One.
                  </p>
                </div>
                <div className="field">
                  <label>Module *</label>
                  <AdaptiveSelect
                    required
                    value={form.masterModule}
                    onChange={(e) => {
                      const moduleId = e.target.value;
                      const first = entitiesForModule(moduleId)[0];
                      setForm((prev) => ({
                        ...prev,
                        masterModule: moduleId,
                        masterEntity: first?.id || '',
                        masterPayload: emptyMasterPayload(first?.id || ''),
                      }));
                      setOtherAttachment(null);
                      if (otherAttachmentRef.current) otherAttachmentRef.current.value = '';
                    }}
                  >
                    {MASTER_MODULES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Master *</label>
                  <AdaptiveSelect
                    required
                    value={form.masterEntity}
                    onChange={(e) => {
                      const entityId = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        masterEntity: entityId,
                        masterPayload: emptyMasterPayload(entityId),
                      }));
                      setOtherAttachment(null);
                      if (otherAttachmentRef.current) otherAttachmentRef.current.value = '';
                    }}
                  >
                    {entitiesForModule(form.masterModule).map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.label}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                {(getMasterEntity(form.masterEntity)?.id === 'pin-codes'
                  ? []
                  : getMasterEntity(form.masterEntity)?.fields || []
                )
                  .filter((field) => {
                    if (form.masterEntity === 'contacts') {
                      return !['state', 'city', 'pinCode', 'district'].includes(field.name);
                    }
                    return true;
                  })
                  .map((field) => (
                  <div className="field" key={field.name}>
                    <label>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {field.type === 'select' && field.options ? (
                      <AdaptiveSelect
                        required={!!field.required}
                        value={form.masterPayload?.[field.name] || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              [field.name]: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Select…</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    ) : field.type === 'select' && field.source === 'categories' ? (
                      <AdaptiveSelect
                        required={!!field.required}
                        value={form.masterPayload?.[field.name] || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              [field.name]: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Select category…</option>
                        {(logisticsMeta?.categories || []).map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    ) : field.type === 'select' && field.source === 'uoms' ? (
                      <AdaptiveSelect
                        value={form.masterPayload?.[field.name] || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              [field.name]: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Select UOM…</option>
                        {(logisticsMeta?.uoms || []).map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    ) : field.type === 'select' && field.source === 'warehouses' ? (
                      <AdaptiveSelect
                        required={!!field.required}
                        value={form.masterPayload?.[field.name] || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              [field.name]: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Select warehouse…</option>
                        {(logisticsMeta?.warehouses || []).map((w) => (
                          <option key={w._id} value={w._id}>
                            {w.name}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        required={!!field.required}
                        rows={2}
                        value={form.masterPayload?.[field.name] || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              [field.name]: e.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      <input
                        required={!!field.required}
                        value={form.masterPayload?.[field.name] || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              [field.name]: e.target.value,
                            },
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
                {(form.masterEntity === 'pin-codes' || form.masterEntity === 'contacts') && (
                  <div className="field arq-span">
                    <LocationCascade
                      required={form.masterEntity === 'pin-codes'}
                      showPin={form.masterEntity === 'contacts'}
                      pinRequired={false}
                      value={{
                        stateId: form.masterPayload?.stateId || '',
                        districtId: form.masterPayload?.districtId || '',
                        cityId: form.masterPayload?.cityId || '',
                        state: form.masterPayload?.state || '',
                        district: form.masterPayload?.district || '',
                        city: form.masterPayload?.city || '',
                        pinCode: form.masterPayload?.pinCode || '',
                      }}
                      onChange={(loc) =>
                        setForm((prev) => ({
                          ...prev,
                          masterPayload: {
                            ...(prev.masterPayload || {}),
                            stateId: loc.stateId || '',
                            districtId: loc.districtId || '',
                            cityId: loc.cityId || '',
                            state: loc.state || '',
                            district: loc.district || '',
                            city: loc.city || '',
                            pinCode:
                              form.masterEntity === 'pin-codes'
                                ? prev.masterPayload?.pinCode || ''
                                : loc.pinCode || '',
                          },
                        }))
                      }
                    />
                  </div>
                )}
                {form.masterEntity === 'pin-codes' && (
                  <>
                    <div className="field">
                      <label>PIN code *</label>
                      <input
                        required
                        value={form.masterPayload?.pinCode || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              pinCode: e.target.value,
                            },
                          }))
                        }
                        maxLength={6}
                      />
                    </div>
                    <div className="field">
                      <label>Locality</label>
                      <input
                        value={form.masterPayload?.locality || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              locality: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Notes</label>
                      <input
                        value={form.masterPayload?.notes || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            masterPayload: {
                              ...(prev.masterPayload || {}),
                              notes: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </>
                )}
                {getMasterEntity(form.masterEntity)?.docxUpload ? (
                  <div className="field arq-span">
                    <label>Word template (.docx) *</label>
                    <FilePicker
                      ref={otherAttachmentRef}
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setOtherAttachment(e.target.files?.[0] || null)}
                    />
                  </div>
                ) : null}
                <div className="field arq-span">
                  <label>Note (optional)</label>
                  <input
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Why this master is needed"
                  />
                </div>
              </>
            )}

            {/* -- Other -- */}
            {form.requestType === 'OTHER' && (
              <>
                <div className="field">
                  <label>Category *</label>
                  <AdaptiveSelect
                    required
                    value={form.otherCategory}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        otherCategory: e.target.value,
                        otherSubcategory: '',
                      }))
                    }
                  >
                    <option value="">Select category</option>
                    {Object.keys(OTHER_REQUEST_OPTIONS).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Request option *</label>
                  <AdaptiveSelect
                    required
                    disabled={!form.otherCategory}
                    value={form.otherSubcategory}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, otherSubcategory: e.target.value }))
                    }
                  >
                    <option value="">
                      {form.otherCategory ? 'Select request option' : 'Select category first'}
                    </option>
                    {(OTHER_REQUEST_OPTIONS[form.otherCategory] || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Attachment (optional)</label>
                  <FilePicker
                    ref={otherAttachmentRef}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => setOtherAttachment(e.target.files?.[0] || null)}
                  />
                  <span className="muted mono-sm">
                    Image, PDF, Word, Excel, or text file.
                  </span>
                </div>
              </>
            )}

            {!needsAsset &&
              form.requestType !== 'LOGISTICS' &&
              !['TRAINING', 'REIMBURSEMENT', 'HIRING', 'OTHER'].includes(
                form.requestType
              ) && (
              <>
                <div className="field">
                  <label>Source (Asset Custody)</label>
                  <AdaptiveSelect
                    value={form.assetCustody}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assetId: '',
                        contactId: '',
                        assetCustody: e.target.value,
                        custodianName: '',
                      }))
                    }
                  >
                    <option value="">Select source</option>
                    {custodyOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Custodian name</label>
                  <AdaptiveSelect
                    value={form.custodianName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assetId: '',
                        contactId: '',
                        custodianName: e.target.value,
                      }))
                    }
                >
                    <option value="">Select custodian</option>
                    {sourceCustodianOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
              </>
            )}

            {needsAsset && (
              <>
                {/* Asset details are only relevant to Logistics requests containing devices. */}
                <div className="field arq-span">
                  <h4 className="arq-section-title">
                    {needsAsset ? 'Linked asset *' : 'Linked asset (optional)'}
                  </h4>
                </div>

                <div className="field">
                  <label>Source ({FIELD.ASSET_CUSTODY})</label>
                  <AdaptiveSelect value={form.assetCustody} onChange={(e) => linkFromCustody(e.target.value)}>
                    <option value="">Select</option>
                    {custodyOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>

                <div className="field">
                  <label>
                    {FIELD.ASSET_NAME}
                    {needsAsset ? ' *' : ''}
                  </label>
                  <AdaptiveSelect
                    required={needsAsset}
                    value={form.assetId}
                    onChange={(e) => linkFromAssetId(e.target.value)}
                  >
                    <option value="">Select asset</option>
                    {assetNameOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                        {a.serial ? ` · ${a.serial}` : ''}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>

                <div className="field">
                  <label>{FIELD.CUSTODIAN_NAME}</label>
                  <AdaptiveSelect value={form.custodianName} onChange={(e) => linkFromCustodianName(e.target.value)}>
                    <option value="">Select</option>
                    {custodianNameOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
              </>
            )}

            {!['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(form.requestType) && (
              <div className="field">
                <label>Reason / description (optional)</label>
                <input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Add a short note"
                />
              </div>
            )}
          </div>
          <p className="muted arq-hint">
            Linked Asset Register and Contact Directory fields auto-fill when a unique match is found.
            Asset is required for Repair &amp; Maintenance, and for Goods Issue rows categorized as
            Medical Device or Non-Medical Device.
          </p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      )}

      <div className="arq-type-tabs" role="tablist" aria-label="Filter by request type">
        <button
          type="button"
          className={`arq-type-tab${!typeFilter ? ' is-active' : ''}`}
          onClick={() => {
            setTypeFilter('');
            setPage(1);
          }}
        >
          All
        </button>
        {REQUEST_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`arq-type-tab${typeFilter === t.value ? ' is-active' : ''}`}
            onClick={() => {
              setTypeFilter(t.value);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Details</th>
              <th>Asset</th>
              <th>Requestor</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const isMine = String(r.requestorId?._id || r.requestorId) === String(user?.id);
              const isActive = r.status === 'REQUESTED' || r.status === 'APPROVED';
              const isServiceRequest =
                r.requestType === 'REPAIR' || r.requestType === 'MAINTENANCE';
              const overdue =
                r.status === 'REQUESTED' && isApprovalOverdue(r.createdAt || r.requestedAt);
              return (
                <tr key={r._id}>
                  <td className="mono-sm">{r.requestNumber}</td>
                  <td>{displayType(r.requestType)}</td>
                  <td>
                    <span className={`badge ${overdue ? 'tone-danger' : 'tone-neutral'}`}>
                      {r.status}
                    </span>
                    {overdue ? (
                      <span className="badge tone-danger" style={{ marginLeft: 6 }}>
                        Overdue
                      </span>
                    ) : null}
                  </td>
                  <td className="muted mono-sm">{detailSummary(r) || '-'}</td>
                  <td>
                    <strong>
                      {r.assetName ||
                        r.trainingTopic ||
                        r.hiringName ||
                        (r.requestType === 'MASTER_ADD'
                          ? getMasterEntity(r.masterEntity)?.label || r.masterEntity
                          : '-') ||
                        '-'}
                    </strong>
                    <div className="muted mono-sm">
                      {r.requestType === 'MASTER_ADD'
                        ? [
                            MASTER_MODULES.find((m) => m.id === r.masterModule)?.label ||
                              r.masterModule,
                            r.createdMasterCode ? `Created ${r.createdMasterCode}` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : r.assetCustody ||
                          r.payeeName ||
                          r.traineeName ||
                          [r.hiringCity, r.hiringState].filter(Boolean).join(', ') ||
                          ''}
                    </div>
                  </td>
                  <td>{r.requestorId?.fullName || r.requestorId?.email || '-'}</td>
                  <td className="arq-reason">{r.reason || '-'}</td>
                  <td>
                    <div className="arq-actions">
                      {canApprove && r.status === 'REQUESTED' && !isMine && (
                        <>
                          <button type="button" className="btn btn-compact" onClick={() => act(r._id, 'approve')}>
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn secondary btn-compact"
                            onClick={() => act(r._id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canApprove && r.status === 'APPROVED' && (
                        <button type="button" className="btn secondary btn-compact" onClick={() => act(r._id, 'complete')}>
                          Complete
                        </button>
                      )}
                      {r.status === 'REQUESTED' && isMine && (
                        <span className="muted mono-sm">Awaiting approval</span>
                      )}
                      {isActive && (canApprove || (canRequest && isMine)) && (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          onClick={() => cancelRequest(r)}
                        >
                          Cancel
                        </button>
                      )}
                      {isServiceRequest &&
                        (r.productImage || r.productImageMetadata || r.productImagePath) && (
                          <button
                            type="button"
                            className="btn secondary btn-compact"
                            onClick={() => openProductImage(r)}
                          >
                            View image
                          </button>
                        )}
                      {r.requestType === 'REIMBURSEMENT' && r.billAttachment && (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          onClick={() => openBill(r)}
                        >
                          View bill
                        </button>
                      )}
                      {(r.requestType === 'OTHER' || r.requestType === 'MASTER_ADD') &&
                        r.requestAttachment && (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          onClick={() => openRequestAttachment(r)}
                        >
                          View attachment
                        </button>
                      )}
                      {isServiceRequest &&
                        isActive &&
                        (canApprove || (canRequest && isMine)) && (
                        <>
                          <button
                            type="button"
                            className="btn secondary btn-compact"
                            disabled={linkBusyId === r._id}
                            onClick={() => generateImageLink(r)}
                          >
                            {linkBusyId === r._id ? 'Generating…' : 'Generate image link'}
                          </button>
                          {generatedLinks[r._id] && (
                            <div className="arq-generated-link">
                              <code>{generatedLinks[r._id]}</code>
                              <button
                                type="button"
                                className="btn secondary btn-compact"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(generatedLinks[r._id]);
                                    setMsg('Product image link copied to clipboard.');
                                  } catch {
                                    setError('Could not copy the link. Select and copy it manually.');
                                  }
                                }}
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length && (
              <tr>
                <td colSpan={8} className="muted">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
      </div>
    </PageShell>
  );
}
