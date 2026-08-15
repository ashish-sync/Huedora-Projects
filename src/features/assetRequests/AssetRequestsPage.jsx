import { useEffect, useMemo, useRef, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';
import { productAssetName, productOptionLabel } from '../../shared/productMasterLabel.js';
import { FIELD, MODULE, ACTION } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { FALLBACK_PRODUCT } from '../logistics/logisticsTxnShared.jsx';
import { isApprovalOverdue } from '../../shared/approvalTiming.js';
import WatchFollowButton from '../notifications/WatchFollowButton.jsx';
import '../notifications/notifications.css';
import { canApproveRequestType, approvalRuleLabel } from './requestApproval.js';
import {
  MASTER_MODULES,
  entitiesForModule,
  getMasterEntity,
  emptyMasterPayload,
  validateMasterPayload,
} from '../masters/masterCatalog.js';
import { campApi, clientMasterApi } from '../camps/campOpsApi.js';
import {
  formatLinkedCampSummary,
  mapCampToHiringPrefill,
} from '../camps/utils/campHireRequest.js';
import {
  parseClientMasterListResponse,
  resolveClientMasterHealthcareWorkers,
} from '../camps/utils/clientMasterCascade.js';
import { normalizeHealthcareWorkers } from '../camps/utils/healthcareWorkers.js';
import { isVendorContact } from '../agreements/contactPicklists.js';

const REQUEST_TYPES = [
  { value: 'SERVICE', label: 'Repair & Service Request', needsAsset: true },
  { value: 'LOGISTICS', label: 'Goods Issuance Request', needsAsset: true },
  { value: 'TRAINING', label: 'Training Request', needsAsset: false },
  { value: 'REIMBURSEMENT', label: 'Finance One Request', needsAsset: false },
  { value: 'HIRING', label: 'Hiring Request', needsAsset: false },
  { value: 'MASTER_ADD', label: 'Master One Request', needsAsset: false },
  { value: 'OTHER', label: 'Other Requests', needsAsset: false },
];

const SERVICE_TYPES = ['Hardware', 'Software', 'Calibration', 'Power', 'Cosmetic', 'Maintenance'];
const LOGISTICS_KINDS = ['Fresh Dispatch', 'Inter Transfer', 'Recall / Pickup'];
const TRANSPORT_MODES = [
  'Fragile',
  'Air Delivery',
  'Porter',
  'Hand Delivery',
  'Blue Dart',
  'DTDC',
];
const TRAINING_TYPES = [
  'Fresh Training',
  'Refresher Device',
  'Non Device Refresher',
  'L1 Troubleshooting',
  'FTE onboarding',
];
const NON_DEVICE_REFRESHER = 'Non Device Refresher';
const NON_DEVICE_TRAINING_NAMES = [
  'Compliance & SOPs',
  'Software & Systems',
  'Attendance & Discipline',
  'Operations & Process',
  'All Other Training',
];
const TRAINING_MODES = ['Virtual', 'Physical'];

function isNonDeviceRefresher(trainingType) {
  const value = String(trainingType || '').trim().toLowerCase();
  return value === 'non device refresher' || value === 'refresher non device';
}
const HIRING_TYPES = ['Full Timer', 'Freelancer'];
const HCW_TYPES = ['Phlebotomist', 'Technician', 'Dietician', 'Physio', 'Others'];
const CAMP_TYPES = ['No Device', 'Light Device (1-5 KG)', 'Heavy Device (5-12 KG)'];
const HIRING_METHODS = ['BMD', 'Neuro & Physio', 'Uroflowmetery', 'Diagnostics', 'Dietician', 'Others'];
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
  return { productType: '', productId: '', productName: '', qty: '' };
}

function isLogisticsProductRowComplete(item) {
  return Boolean(
    item?.productType &&
      item?.productId &&
      item?.productName &&
      Number.isFinite(Number(item.qty)) &&
      Number(item.qty) > 0
  );
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
  trainingName: '',
  trainingProductId: '',
  trainingMode: '',
  traineeContactId: '',
  traineeName: '',
  venue: '',
  amount: '',
  currency: 'INR',
  expenseCategory: '',
  expenseSubCategory: '',
  expenseSubCategoryId: '',
  payeeName: '',
  raisedFor: 'SELF',
  raisedForContactId: '',
  associateWithClient: 'NO',
  clientMasterId: '',
  clientId: '',
  clientName: '',
  clientCode: '',
  divisionTherapy: '',
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
  if (t === 'MOVEMENT' || t === 'LOGISTICS') return 'Goods Issuance Request';
  if (t === 'REPAIR' || t === 'MAINTENANCE') return 'Repair & Service Request';
  return REQUEST_TYPES.find((x) => x.value === t)?.label || t;
}

function productOptionLabelLocal(p) {
  return productOptionLabel(p) || p?._id || '';
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
    r.issueCategory ||
      r.maintenanceKind ||
      normalizeLogisticsKind(r.logisticsKind) ||
      (r.requestType === 'REIMBURSEMENT'
        ? [r.expenseCategory, r.expenseSubCategory].filter(Boolean).join(' · ')
        : r.expenseCategory) ||
      r.otherCategory,
    r.otherSubcategory,
    r.requestType === 'REIMBURSEMENT'
      ? r.raisedFor === 'OTHER' || (r.payeeName && r.payeeName !== 'Self')
        ? `Raised for: ${r.payeeName || 'Other'}`
        : 'Raised for: Self'
      : '',
    r.requestType === 'REIMBURSEMENT' && r.associateWithClient
      ? `Client: ${[r.clientCode, r.divisionTherapy || r.clientName].filter(Boolean).join(' · ') || '—'}`
      : '',
    r.trainingTopic,
    r.trainingName || r.assetName,
    r.traineeName,
    r.hiringType,
    r.hcwType,
    r.campType,
    r.hiringMethod,
    r.hireeName
      ? `Hiree: ${r.hireeName}${r.hireeContact ? ` · ${r.hireeContact}` : ''}${
          r.payableAmount != null && r.payableAmount !== '' ? ` · ₹${r.payableAmount}` : ''
        }`
      : '',
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
  const userCanApproveType = (requestType) => canApproveRequestType(user, can, requestType);

  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [vendorContacts, setVendorContacts] = useState([]);
  const [logisticsMeta, setLogisticsMeta] = useState(null);
  const [expenseMaster, setExpenseMaster] = useState({ expenseCategories: [], expenseSubCategories: [] });
  const [clients, setClients] = useState([]);
  const [clientMasters, setClientMasters] = useState([]);
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
  const [reimbursementBill, setReimbursementBill] = useState(null);
  const [otherAttachment, setOtherAttachment] = useState(null);
  const [jdUploadPrompt, setJdUploadPrompt] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [jdBusy, setJdBusy] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState(null);
  const [fulfillForm, setFulfillForm] = useState({
    hireeName: '',
    hireeContact: '',
    payableAmount: '',
  });
  const [fulfillBusy, setFulfillBusy] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState({});
  const [linkBusyId, setLinkBusyId] = useState('');
  const [linkedCamp, setLinkedCamp] = useState(null);
  const [linkedCampLoading, setLinkedCampLoading] = useState(false);
  const campPrefillKeyRef = useRef('');
  const reimbursementBillRef = useRef(null);
  const otherAttachmentRef = useRef(null);
  const jdFileRef = useRef(null);

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
    if (raw === 'REIMBURSEMENT') {
      loadExpenseMaster();
      loadClientMasterOptions();
    }
  }, [searchParams]);

  useEffect(() => {
    const requestType = String(searchParams.get('type') || '').toUpperCase();
    const campRecordId = String(searchParams.get('campRecordId') || '').trim();
    if (requestType !== 'HIRING' || !campRecordId) {
      if (!campRecordId) setLinkedCamp(null);
      return undefined;
    }

    const prefillKey = `${campRecordId}|${searchParams.get('roles') || ''}`;
    if (campPrefillKeyRef.current === prefillKey) return undefined;

    let cancelled = false;
    setLinkedCampLoading(true);

    (async () => {
      try {
        const campResponse = await campApi.get(campRecordId);
        const camp = campResponse?.data?.data || campResponse?.data;
        if (!camp || cancelled) return;

        const clientId = camp.clientId || camp.client?._id || camp.client || '';
        let masters = [];
        if (clientId) {
          try {
            const masterResponse = await clientMasterApi.listByClient(clientId);
            masters = parseClientMasterListResponse(masterResponse);
          } catch {
            masters = [];
          }
        }

        const queryRoles = normalizeHealthcareWorkers(searchParams.get('roles'));
        const matchedMaster = masters.find((record) => {
          const program = String(record.programName || record.drugTherapyName || '').trim().toLowerCase();
          const method = String(record.campName || '').trim().toLowerCase();
          return (
            program === String(camp.campaignType || '').trim().toLowerCase()
            && method === String(camp.campaignName || '').trim().toLowerCase()
          );
        }) || masters.find((record) => record.isActive !== false) || null;

        const rolesFromMaster = resolveClientMasterHealthcareWorkers(masters, {
          campaignType: camp.campaignType,
          campaignName: camp.campaignName,
        });
        const masterForPrefill = matchedMaster
          ? {
              ...matchedMaster,
              healthcareWorker: rolesFromMaster.length
                ? rolesFromMaster
                : matchedMaster.healthcareWorker,
            }
          : {
              campName: camp.campaignName,
              campType: camp.campType,
              healthcareWorker: queryRoles.length ? queryRoles : rolesFromMaster,
            };

        const prefill = mapCampToHiringPrefill(camp, masterForPrefill);
        if (cancelled) return;

        setLinkedCamp(camp);
        setTypeFilter('HIRING');
        setForm((prev) => ({
          ...prev,
          ...prefill,
          hiringType: '',
          budgetMin: '',
          budgetMax: '',
          reason: '',
        }));
        campPrefillKeyRef.current = prefillKey;
      } catch (err) {
        if (!cancelled) {
          setLinkedCamp(null);
          setError(err?.message || 'Could not load camp details for hiring request');
        }
      } finally {
        if (!cancelled) setLinkedCampLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const contactsById = useMemo(() => {
    const map = new Map();
    for (const c of contacts) map.set(String(c._id), c);
    for (const c of vendorContacts) map.set(String(c._id), c);
    return map;
  }, [contacts, vendorContacts]);
  const logisticsConfig = logisticsMeta?.inOut || {};
  const logisticsProductTypes = logisticsConfig.productTypes || FALLBACK_PRODUCT;
  const logisticsProducts = logisticsMeta?.products || [];
  const trainingDeviceProducts = useMemo(
    () =>
      logisticsProducts.filter(
        (product) =>
          product?.isActive !== false && ASSET_PRODUCT_TYPES.has(String(product.productType || ''))
      ),
    [logisticsProducts]
  );
  const expenseCategories = expenseMaster.expenseCategories || [];
  const expenseSubCategories = expenseMaster.expenseSubCategories || [];

  const activeExpenseSubCategories = useMemo(
    () => expenseSubCategories.filter((row) => row.isActive !== false),
    [expenseSubCategories]
  );

  const expenseSubCategoryNames = useMemo(() => {
    const names = new Set();
    for (const row of activeExpenseSubCategories) {
      const name = String(row.name || '').trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [activeExpenseSubCategories]);

  const categoriesForSelectedSub = useMemo(() => {
    const selectedName = String(form.expenseSubCategory || '').trim();
    if (!selectedName) return [];
    const matches = activeExpenseSubCategories.filter(
      (row) => String(row.name || '').trim() === selectedName
    );
    const seen = new Set();
    const categories = [];
    for (const match of matches) {
      const categoryId = String(match.categoryId || '');
      if (!categoryId || seen.has(categoryId)) continue;
      seen.add(categoryId);
      const fromMaster = expenseCategories.find((category) => String(category._id) === categoryId);
      categories.push(
        fromMaster || {
          _id: match.categoryId,
          name: match.categoryName || '',
        }
      );
    }
    return categories.filter((category) => category.name);
  }, [activeExpenseSubCategories, expenseCategories, form.expenseSubCategory]);

  const expenseCategoryLocked = categoriesForSelectedSub.length === 1;

  const resolveExpenseSubCategoryId = (subCategoryName, categoryName) => {
    const selectedName = String(subCategoryName || '').trim();
    const selectedCategory = String(categoryName || '').trim();
    if (!selectedName || !selectedCategory) return '';
    const category = expenseCategories.find(
      (row) => String(row.name || '').trim() === selectedCategory
    );
    const match = activeExpenseSubCategories.find((row) => {
      const sameName = String(row.name || '').trim() === selectedName;
      if (!sameName) return false;
      if (category?._id) return String(row.categoryId) === String(category._id);
      return String(row.categoryName || '').trim() === selectedCategory;
    });
    return match?._id ? String(match._id) : '';
  };

  const pickExpenseSubCategory = (subCategoryName) => {
    const selectedName = String(subCategoryName || '').trim();
    if (!selectedName) {
      setForm((prev) => ({
        ...prev,
        expenseSubCategoryId: '',
        expenseSubCategory: '',
        expenseCategory: '',
      }));
      return;
    }
    const matches = activeExpenseSubCategories.filter(
      (row) => String(row.name || '').trim() === selectedName
    );
    const categoryIds = [
      ...new Set(matches.map((row) => String(row.categoryId || '')).filter(Boolean)),
    ];
    if (categoryIds.length === 1) {
      const category =
        expenseCategories.find((row) => String(row._id) === categoryIds[0]) || null;
      const categoryName = category?.name || matches[0]?.categoryName || '';
      setForm((prev) => ({
        ...prev,
        expenseSubCategory: selectedName,
        expenseCategory: categoryName,
        expenseSubCategoryId: resolveExpenseSubCategoryId(selectedName, categoryName),
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      expenseSubCategory: selectedName,
      expenseCategory: '',
      expenseSubCategoryId: '',
    }));
  };

  const pickExpenseCategory = (categoryName) => {
    const selectedCategory = String(categoryName || '').trim();
    setForm((prev) => ({
      ...prev,
      expenseCategory: selectedCategory,
      expenseSubCategoryId: resolveExpenseSubCategoryId(prev.expenseSubCategory, selectedCategory),
    }));
  };

  const pickRaisedForContact = (contactId) => {
    const contact = contactsById.get(String(contactId));
    setForm((prev) => ({
      ...prev,
      raisedForContactId: contactId,
      payeeName: contact?.name || '',
    }));
  };

  const clientsById = useMemo(() => {
    const map = new Map();
    for (const client of clients) map.set(String(client._id), client);
    return map;
  }, [clients]);

  const activeClientMasters = useMemo(
    () =>
      clientMasters
        .filter((row) => row.isActive !== false)
        .map((row) => {
          const client = clientsById.get(String(row.clientId || ''));
          const code = client?.code || '';
          const division = row.programName || row.drugTherapyName || '';
          return {
            ...row,
            clientCode: code,
            divisionTherapy: division,
            optionLabel: [code || '—', division || '—'].join(' · '),
          };
        }),
    [clientMasters, clientsById]
  );

  const pickExpenseClientMaster = (clientMasterId) => {
    const row = activeClientMasters.find((item) => String(item._id) === String(clientMasterId));
    setForm((prev) => ({
      ...prev,
      clientMasterId,
      clientId: row?.clientId ? String(row.clientId) : '',
      clientName: row?.clientName || '',
      clientCode: row?.clientCode || '',
      divisionTherapy: row?.divisionTherapy || '',
    }));
  };

  const loadExpenseMaster = () =>
    api('/logistics/expense-master')
      .then((r) =>
        setExpenseMaster({
          expenseCategories: r.data?.expenseCategories || [],
          expenseSubCategories: r.data?.expenseSubCategories || [],
        })
      )
      .catch(() => setExpenseMaster({ expenseCategories: [], expenseSubCategories: [] }));

  const loadClientMasterOptions = () =>
    Promise.all([
      api('/camp-ops/clients?limit=100').then((r) => r.data || []).catch(() => []),
      api('/camp-ops/client-masters?limit=100').then((r) => r.data || []).catch(() => []),
    ]).then(([clientRows, masterRows]) => {
      setClients(clientRows);
      setClientMasters(masterRows);
    });

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
  const logisticsNeedsAsset =
    form.requestType === 'LOGISTICS' &&
    form.logisticsProducts.some((item) => ASSET_PRODUCT_TYPES.has(item.productType));
  const needsAsset =
    form.requestType === 'LOGISTICS' ? logisticsNeedsAsset : typeMeta(form.requestType).needsAsset;
  const logisticsContextReady = Boolean(
    (normalizeLogisticsKind(form.logisticsKind) || form.logisticsKind) && form.transportMode
  );
  const canAddLogisticsProduct =
    logisticsContextReady &&
    form.logisticsProducts.length > 0 &&
    form.logisticsProducts.every((item) => isLogisticsProductRowComplete(item));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter]);

  useEffect(() => {
    // Keep the list route light — load picklist data only when a create type needs it.
    api('/logistics/meta')
      .then((r) => setLogisticsMeta(r.data || null))
      .catch(() => setLogisticsMeta(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const type = String(form.requestType || '').toUpperCase();
    if (!type) return undefined;
    let cancelled = false;

    const needsContacts =
      type === 'TRANSFER' ||
      type === 'RETURN' ||
      type === 'HIRING' ||
      type === 'SERVICE' ||
      type === 'REPAIR' ||
      type === 'MAINTENANCE' ||
      type === 'LOGISTICS';
    const needsAssets =
      type === 'TRANSFER' ||
      type === 'RETURN' ||
      type === 'SERVICE' ||
      type === 'REPAIR' ||
      type === 'MAINTENANCE' ||
      type === 'LOGISTICS';
    const needsVendors = type === 'LOGISTICS' || type === 'SERVICE' || type === 'REPAIR';
    const needsClients = type === 'REIMBURSEMENT' || type === 'HIRING' || type === 'LOGISTICS';

    if (needsAssets) {
      api('/assets?limit=100')
        .then((r) => {
          if (!cancelled) setAssets(r.data || []);
        })
        .catch(() => {});
    }
    if (needsContacts) {
      api('/contacts?limit=100')
        .then((r) => {
          if (!cancelled) setContacts(r.data || []);
        })
        .catch(() => {});
    }
    if (needsVendors) {
      api('/contacts?limit=100&contactCategory=Vendor')
        .then((r) => {
          if (!cancelled) setVendorContacts((r.data || []).filter((c) => isVendorContact(c)));
        })
        .catch(() => {
          if (!cancelled) setVendorContacts([]);
        });
    }
    if (needsClients) {
      loadClientMasterOptions();
    }
    if (type === 'REIMBURSEMENT') {
      loadExpenseMaster();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.requestType]);

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
    } else {
      loadExpenseMaster();
      loadClientMasterOptions();
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
      ...(requestType === 'REIMBURSEMENT'
        ? {
            expenseCategory: '',
            expenseSubCategory: '',
            expenseSubCategoryId: '',
            expenseDate: '',
            amount: '',
            reason: '',
            raisedFor: 'SELF',
            raisedForContactId: '',
            payeeName: '',
            associateWithClient: 'NO',
            clientMasterId: '',
            clientId: '',
            clientName: '',
            clientCode: '',
            divisionTherapy: '',
          }
        : {}),
      ...(['TRAINING', 'HIRING', 'MASTER_ADD'].includes(requestType) ? { reason: '' } : {}),
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
            productName: productAssetName(product) || product.name || product.productName || '',
            productType: product.productType || form.logisticsProducts[index].productType,
          }
        : { productId: '', productName: '' }
    );
  };

  const addLogisticsProduct = () => {
    const incomplete = form.logisticsProducts.some((item) => !isLogisticsProductRowComplete(item));
    if (incomplete) {
      setError('Fill Product category, Model/Variant/Name, and Qty before adding another product.');
      return;
    }
    setError('');
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
    if (
      !(normalizeLogisticsKind(form.logisticsKind) || form.logisticsKind) ||
      !form.transportMode
    ) {
      setError('Select Issue kind and Delivery mode before confirming products.');
      return;
    }
    const invalid = form.logisticsProducts.some((item) => !isLogisticsProductRowComplete(item));
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
    if (form.requestType === 'TRAINING') {
      if (!form.trainingTopic) {
        setError('Select a training type.');
        return;
      }
      if (isNonDeviceRefresher(form.trainingTopic)) {
        if (!form.trainingName) {
          setError('Select a training name.');
          return;
        }
      } else if (!form.trainingProductId) {
        setError('Select an asset / device name from Product Master.');
        return;
      }
      if (form.trainingMode === 'Physical' && (!form.traineeContactId || !form.venue)) {
        setError('Physical training requires a trainee with a city in Contact Directory.');
        return;
      }
    }
    if (needsAsset && !form.assetId) {
      setError(
        form.requestType === 'LOGISTICS'
          ? 'Select an asset name for Medical Device or Non-Medical Device products.'
          : 'Select an asset name for this request type.'
      );
      return;
    }
    if (
      form.requestType === 'LOGISTICS' &&
      form.logisticsProducts.some((item) => !isLogisticsProductRowComplete(item))
    ) {
      setError('Complete every goods issue product row and enter a positive quantity.');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !form.logisticsProductsConfirmed) {
      setError('Confirm the selected products before choosing contacts and submitting.');
      return;
    }
    if (form.requestType === 'REIMBURSEMENT' && !reimbursementBill) {
      setError('Upload the expense bill before submitting the Finance One Request.');
      return;
    }
    if (form.requestType === 'REIMBURSEMENT') {
      if (!form.expenseSubCategoryId || !form.expenseSubCategory) {
        setError('Select an expense sub-category from Expense Master.');
        return;
      }
      if (!form.expenseCategory) {
        setError('Expense category could not be determined for the selected sub-category.');
        return;
      }
      if (form.raisedFor === 'OTHER' && !form.raisedForContactId) {
        setError('Select who this expense is raised for from Contact Directory.');
        return;
      }
      if (form.associateWithClient === 'YES' && !form.clientMasterId) {
        setError('Select Code and Division / Therapy from Client Master.');
        return;
      }
      if (!form.expenseDate) {
        setError('Expense date is required.');
        return;
      }
      if (!form.amount || Number(form.amount) <= 0) {
        setError('Enter a valid expense amount.');
        return;
      }
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
      const omitReason = ['TRAINING', 'MASTER_ADD'].includes(form.requestType);
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
        const nonDevice = isNonDeviceRefresher(form.trainingTopic);
        body.trainingTopic = form.trainingTopic;
        body.trainingName = nonDevice ? form.trainingName : form.trainingName || undefined;
        body.trainingProductId = nonDevice ? undefined : form.trainingProductId || undefined;
        body.assetName = nonDevice ? '' : form.trainingName || '';
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
        body.expenseSubCategory = form.expenseSubCategory;
        body.expenseDate = form.expenseDate || undefined;
        body.reason = form.reason || '';
        body.raisedFor = form.raisedFor === 'OTHER' ? 'OTHER' : 'SELF';
        body.raisedForContactId =
          form.raisedFor === 'OTHER' ? form.raisedForContactId || undefined : undefined;
        body.payeeName =
          form.raisedFor === 'OTHER' ? form.payeeName || undefined : 'Self';
        body.associateWithClient = form.associateWithClient === 'YES';
        body.clientMasterId =
          form.associateWithClient === 'YES' ? form.clientMasterId || undefined : undefined;
        body.clientId =
          form.associateWithClient === 'YES' ? form.clientId || undefined : undefined;
        body.clientName =
          form.associateWithClient === 'YES' ? form.clientName || undefined : undefined;
        body.clientCode =
          form.associateWithClient === 'YES' ? form.clientCode || undefined : undefined;
        body.divisionTherapy =
          form.associateWithClient === 'YES' ? form.divisionTherapy || undefined : undefined;
      }
      if (form.requestType === 'HIRING') {
        body.hiringType = form.hiringType;
        body.hcwType = form.hcwType;
        body.campType = form.campType;
        body.hiringMethod = form.hiringMethod;
        body.hiringState = form.hiringState;
        body.hiringCity = form.hiringCity;
        body.hiringAddress = form.hiringAddress;
        body.hiringPinCode = form.hiringPinCode;
        body.engagementDateTime = form.engagementDateTime;
        body.budgetMin = Number(form.budgetMin);
        body.budgetMax = Number(form.budgetMax);
        if (linkedCamp?._id) {
          body.campRecordId = linkedCamp._id;
          body.campOpsCampId = linkedCamp.campId || '';
          body.campId = linkedCamp.campId || '';
        } else {
          const campRecordId = String(searchParams.get('campRecordId') || '').trim();
          const campId = String(searchParams.get('campId') || '').trim();
          if (campRecordId) body.campRecordId = campRecordId;
          if (campId) {
            body.campOpsCampId = campId;
            body.campId = campId;
          }
        }
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
      setReimbursementBill(null);
      setOtherAttachment(null);
      if (reimbursementBillRef.current) reimbursementBillRef.current.value = '';
      if (otherAttachmentRef.current) otherAttachmentRef.current.value = '';
      setMsg(savedMessage);
      if (form.requestType === 'HIRING' && created?.data?._id) {
        setJdFile(null);
        if (jdFileRef.current) jdFileRef.current.value = '';
        setJdUploadPrompt({
          id: created.data._id,
          requestNumber: created.data.requestNumber || created.data._id,
        });
      }
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

  const openJd = async (request) => {
    setError('');
    try {
      const response = await apiFetch(`/asset-requests/${request._id}/jd`);
      if (!response.ok) throw new Error(`Could not load job description (${response.status})`);
      const blobUrl = URL.createObjectURL(await response.blob());
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(err.message);
    }
  };

  const closeJdPrompt = () => {
    setJdUploadPrompt(null);
    setJdFile(null);
    if (jdFileRef.current) jdFileRef.current.value = '';
  };

  const uploadHiringJd = async (requestId, { closePrompt = true } = {}) => {
    if (!jdFile || !requestId) return;
    setJdBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('attachment', jdFile);
      await api(`/asset-requests/${requestId}/jd`, { method: 'POST', body });
      setMsg('Job description uploaded.');
      if (closePrompt) closeJdPrompt();
      else {
        setJdFile(null);
        if (jdFileRef.current) jdFileRef.current.value = '';
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setJdBusy(false);
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

  const openFulfill = (request) => {
    setError('');
    setFulfillForm({ hireeName: '', hireeContact: '', payableAmount: '' });
    setFulfillTarget({
      id: request._id,
      requestNumber: request.requestNumber || request._id,
    });
  };

  const closeFulfill = () => {
    if (fulfillBusy) return;
    setFulfillTarget(null);
    setFulfillForm({ hireeName: '', hireeContact: '', payableAmount: '' });
  };

  const submitFulfill = async (e) => {
    e?.preventDefault?.();
    if (!fulfillTarget?.id) return;
    const hireeName = String(fulfillForm.hireeName || '').trim();
    const hireeContact = String(fulfillForm.hireeContact || '').trim();
    const payableAmount = Number(fulfillForm.payableAmount);
    if (!hireeName) {
      setError('Enter the hiree Name to fulfill this request.');
      return;
    }
    if (!hireeContact) {
      setError('Enter the Contact Number to fulfill this request.');
      return;
    }
    if (!Number.isFinite(payableAmount) || payableAmount < 0) {
      setError('Enter a valid Payable Amount.');
      return;
    }
    setError('');
    setFulfillBusy(true);
    try {
      await api(`/asset-requests/${fulfillTarget.id}/fulfill`, {
        method: 'POST',
        body: { hireeName, hireeContact, payableAmount },
      });
      setMsg(`Request ${fulfillTarget.requestNumber} fulfilled.`);
      setFulfillTarget(null);
      setFulfillForm({ hireeName: '', hireeContact: '', payableAmount: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setFulfillBusy(false);
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
      await downloadExcel('/asset-requests/export', 'Request_One.xlsx');
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
      description="Submit Repair & Service, Goods Issuance, Training, Finance One, Hiring, Master One, and Other requests."
      actions={
        <button className="btn secondary" type="button" disabled={exportBusy} onClick={downloadMaster}>
          {exportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD_EXCEL}
        </button>
      }
      kpis={[
        { label: 'Total requests', value: rows.length },
        { label: 'Pending approval', value: pending },
      ]}
    >
      {error && <p className="error">{error}</p>}
      {msg && <FeedbackBanner variant="success">{msg}</FeedbackBanner>}

      {jdUploadPrompt && (
        <div className="card arq-jd-prompt" role="dialog" aria-labelledby="arq-jd-prompt-title">
          <h3 id="arq-jd-prompt-title">Upload job description (optional)</h3>
          <p className="muted" style={{ margin: '0 0 var(--space-3)' }}>
            Request <strong>{jdUploadPrompt.requestNumber}</strong> was submitted. Attach a JD
            now, or skip and continue.
          </p>
          <div className="field">
            <label htmlFor="hiring-jd-upload">Job description</label>
            <FilePicker
              ref={jdFileRef}
              id="hiring-jd-upload"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => setJdFile(e.target.files?.[0] || null)}
            />
            <span className="muted mono-sm">Image, PDF, Word, Excel, or text file.</span>
          </div>
          <div className="arq-actions" style={{ marginTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn"
              disabled={!jdFile || jdBusy}
              onClick={() => uploadHiringJd(jdUploadPrompt.id)}
            >
              {jdBusy ? 'Uploading…' : 'Upload JD'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={jdBusy}
              onClick={closeJdPrompt}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {fulfillTarget && (
        <div className="card arq-jd-prompt" role="dialog" aria-labelledby="arq-fulfill-title">
          <h3 id="arq-fulfill-title">Fulfill hiring request</h3>
          <p className="muted" style={{ margin: '0 0 var(--space-3)' }}>
            Enter hiree details for <strong>{fulfillTarget.requestNumber}</strong>, then submit.
          </p>
          <form className="arq-grid" onSubmit={submitFulfill}>
            <div className="field">
              <label htmlFor="hiring-fulfill-name">Name</label>
              <input
                id="hiring-fulfill-name"
                required
                autoComplete="off"
                value={fulfillForm.hireeName}
                onChange={(e) =>
                  setFulfillForm((prev) => ({ ...prev, hireeName: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="hiring-fulfill-contact">Contact Number</label>
              <input
                id="hiring-fulfill-contact"
                required
                inputMode="tel"
                autoComplete="off"
                value={fulfillForm.hireeContact}
                onChange={(e) =>
                  setFulfillForm((prev) => ({ ...prev, hireeContact: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="hiring-fulfill-payable">Payable Amount</label>
              <input
                id="hiring-fulfill-payable"
                required
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                autoComplete="off"
                value={fulfillForm.payableAmount}
                onChange={(e) =>
                  setFulfillForm((prev) => ({ ...prev, payableAmount: e.target.value }))
                }
              />
            </div>
            <div className="arq-actions arq-span" style={{ marginTop: 'var(--space-2)' }}>
              <button type="submit" className="btn" disabled={fulfillBusy}>
                {fulfillBusy ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={fulfillBusy}
                onClick={closeFulfill}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {canRequest && (
        <form className="card arq-form" onSubmit={submit} autoComplete="off" data-form-type="other">
          <h3>New request</h3>
          {(linkedCamp || linkedCampLoading) && form.requestType === 'HIRING' ? (
            <div className="arq-camp-link-banner">
              {linkedCampLoading ? (
                <p className="muted" style={{ margin: 0 }}>Loading camp details…</p>
              ) : (
                <>
                  <div className="arq-camp-link-banner__title">Linked camp</div>
                  <Link
                    className="arq-camp-link-banner__link"
                    to={`/camp-one/manage/${linkedCamp._id}/edit`}
                  >
                    {formatLinkedCampSummary(linkedCamp)}
                  </Link>
                  <p className="muted mono-sm arq-camp-link-banner__hint">
                    Prefilling from this camp and Client Master. Set Hiring type and budget; remarks stay optional.
                  </p>
                </>
              )}
            </div>
          ) : null}
          <div className="arq-grid">
            {form.requestType === 'SERVICE' && form.serviceType !== 'Maintenance' ? (
              <div className="arq-service-top-row arq-span">
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
                <div className="field">
                  <label>Preferred vendor</label>
                  <AdaptiveSelect
                    threshold={1}
                    placeholder="Optional — search Contact Directory…"
                    value={form.preferredVendorContactId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const contact = contactsById.get(id);
                      setForm((prev) => ({
                        ...prev,
                        preferredVendorContactId: id,
                        preferredVendor: contact
                          ? contact.organization || contact.name || ''
                          : '',
                      }));
                    }}
                  >
                    <option value="">Leave blank</option>
                    {vendorContacts.map((contact) => (
                      <option key={contact._id} value={contact._id}>
                        {contact.organization || contact.name || 'Unnamed'}
                        {contact.city ? `: ${contact.city}` : ''}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <DateInput
                  label="Expected return date"
                  value={form.expectedDate}
                  onChange={(value) => setForm({ ...form, expectedDate: value })}
                />
              </div>
            ) : form.requestType === 'LOGISTICS' ? (
              <div className="arq-service-top-row arq-span">
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
                  <AdaptiveSelect
                    required
                    value={form.transportMode}
                    onChange={(e) => setForm({ ...form, transportMode: e.target.value })}
                  >
                    <option value="">Select delivery mode</option>
                    {TRANSPORT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <DateInput
                  label="Preferred date"
                  value={form.logisticsPreferredDate}
                  onChange={(value) =>
                    setForm({ ...form, logisticsPreferredDate: value })
                  }
                />
              </div>
            ) : form.requestType === 'HIRING' ? (
              <div className="arq-service-top-row arq-span">
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
              </div>
            ) : (
              <>
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
              </>
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
                <DateInput
                  label="Scheduled date"
                  value={form.scheduledDate}
                  onChange={(value) => setForm({ ...form, scheduledDate: value })}
                />
              </>
            )}

            {/* -- Goods Issue (aligned with Movement One manual dispatch) -- */}
            {form.requestType === 'LOGISTICS' && (
              <>
                <fieldset
                  className={`arq-product-group arq-span${!logisticsContextReady ? ' is-locked' : ''}`}
                  disabled={!logisticsContextReady}
                  aria-disabled={!logisticsContextReady}
                >
                  <legend>Products *</legend>
                  {!logisticsContextReady ? (
                    <p className="muted arq-product-lock-hint">
                      Select Issue kind and Delivery mode to add products.
                    </p>
                  ) : null}
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
                      const productsLocked =
                        !logisticsContextReady || form.logisticsProductsConfirmed;
                      return (
                        <div className="arq-product-row" key={`logistics-product-${index}`}>
                          <div className="arq-product-cell">
                            <label>Product category *</label>
                            <AdaptiveSelect
                              required={logisticsContextReady}
                              value={item.productType}
                              disabled={productsLocked}
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
                          <div className="arq-product-cell">
                            <label>Model/Variant/Name *</label>
                            <AdaptiveSelect
                              required={logisticsContextReady}
                              value={item.productId}
                              disabled={!item.productType || productsLocked}
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
                                  {productOptionLabelLocal(product)}
                                </option>
                              ))}
                            </AdaptiveSelect>
                          </div>
                          <div className="arq-product-cell">
                            <label htmlFor={`arq-product-qty-${index}`}>Qty *</label>
                            <input
                              id={`arq-product-qty-${index}`}
                              required={logisticsContextReady}
                              type="number"
                              inputMode="decimal"
                              disabled={productsLocked}
                              min="0.01"
                              step="any"
                              value={item.qty}
                              placeholder=""
                              onChange={(event) =>
                                updateLogisticsProduct(index, { qty: event.target.value })
                              }
                            />
                          </div>
                          <div className="arq-product-cell arq-product-remove-cell">
                            <button
                              className="btn secondary arq-product-remove"
                              type="button"
                              disabled={productsLocked}
                              onClick={() => removeLogisticsProduct(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="btn secondary btn-compact"
                    type="button"
                    disabled={form.logisticsProductsConfirmed || !canAddLogisticsProduct}
                    title={
                      !logisticsContextReady
                        ? 'Select Issue kind and Delivery mode first'
                        : canAddLogisticsProduct
                          ? 'Add another product'
                          : 'Complete category, model/variant/name, and qty first'
                    }
                    onClick={addLogisticsProduct}
                  >
                    + Add product
                  </button>
                  <button
                    className="btn btn-compact"
                    type="button"
                    disabled={!logisticsContextReady && !form.logisticsProductsConfirmed}
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
                    onChange={(e) => {
                      const trainingTopic = e.target.value;
                      const nonDevice = isNonDeviceRefresher(trainingTopic);
                      setForm((prev) => ({
                        ...prev,
                        trainingTopic,
                        trainingName: '',
                        trainingProductId: '',
                        assetName: nonDevice ? '' : prev.assetName,
                      }));
                    }}
                  >
                    <option value="">Select training type</option>
                    {TRAINING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                {form.trainingTopic && isNonDeviceRefresher(form.trainingTopic) ? (
                  <div className="field">
                    <label>Training Name *</label>
                    <AdaptiveSelect
                      required
                      value={form.trainingName}
                      onChange={(e) => setForm({ ...form, trainingName: e.target.value })}
                    >
                      <option value="">Select training name</option>
                      {NON_DEVICE_TRAINING_NAMES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </AdaptiveSelect>
                  </div>
                ) : null}
                {form.trainingTopic && !isNonDeviceRefresher(form.trainingTopic) ? (
                  <div className="field">
                    <label>Asset / Device name *</label>
                    <AdaptiveSelect
                      required
                      threshold={1}
                      placeholder="Search Product Master…"
                      value={form.trainingProductId}
                      onChange={(e) => {
                        const productId = e.target.value;
                        const product = trainingDeviceProducts.find(
                          (row) => String(row._id) === String(productId)
                        );
                        setForm((prev) => ({
                          ...prev,
                          trainingProductId: productId,
                          trainingName: product
                            ? productAssetName(product) || product.name || product.productName || ''
                            : '',
                        }));
                      }}
                    >
                      <option value="">
                        {trainingDeviceProducts.length
                          ? 'Select from Product Master'
                          : 'No devices in Product Master'}
                      </option>
                      {trainingDeviceProducts.map((product) => (
                        <option key={product._id} value={product._id}>
                          {productOptionLabelLocal(product)}
                        </option>
                      ))}
                    </AdaptiveSelect>
                  </div>
                ) : null}
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
                <DateInput
                  label="Preferred date"
                  value={form.preferredDate}
                  onChange={(value) => setForm({ ...form, preferredDate: value })}
                />
              </>
            )}

            {/* -- Finance One Request -- */}
            {form.requestType === 'REIMBURSEMENT' && (
              <>
                <div className="field">
                  <label>Expense Sub-Category *</label>
                  <AdaptiveSelect
                    required
                    threshold={1}
                    placeholder="Search expense sub-category…"
                    value={form.expenseSubCategory}
                    onChange={(e) => pickExpenseSubCategory(e.target.value)}
                  >
                    <option value="">
                      {expenseSubCategoryNames.length
                        ? 'Search or select sub-category'
                        : 'No sub-categories in Expense Master'}
                    </option>
                    {expenseSubCategoryNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label>Expense Category *</label>
                  {expenseCategoryLocked ? (
                    <input
                      readOnly
                      required
                      value={form.expenseCategory}
                      placeholder="Auto-filled from sub-category"
                    />
                  ) : (
                    <AdaptiveSelect
                      required
                      threshold={1}
                      disabled={!form.expenseSubCategory}
                      placeholder="Select expense category…"
                      value={form.expenseCategory}
                      onChange={(e) => pickExpenseCategory(e.target.value)}
                    >
                      <option value="">
                        {!form.expenseSubCategory
                          ? 'Select a sub-category first'
                          : categoriesForSelectedSub.length
                            ? 'Select expense category'
                            : 'No categories for this sub-category'}
                      </option>
                      {categoriesForSelectedSub.map((category) => (
                        <option key={category._id} value={category.name}>
                          {category.code ? `${category.code} · ${category.name}` : category.name}
                        </option>
                      ))}
                    </AdaptiveSelect>
                  )}
                </div>
                <div className="field">
                  <label>Raised For *</label>
                  <AdaptiveSelect
                    required
                    value={form.raisedFor}
                    onChange={(e) => {
                      const raisedFor = e.target.value === 'OTHER' ? 'OTHER' : 'SELF';
                      setForm((prev) => ({
                        ...prev,
                        raisedFor,
                        raisedForContactId: raisedFor === 'SELF' ? '' : prev.raisedForContactId,
                        payeeName: raisedFor === 'SELF' ? '' : prev.payeeName,
                      }));
                    }}
                  >
                    <option value="SELF">Self</option>
                    <option value="OTHER">Another person</option>
                  </AdaptiveSelect>
                </div>
                {form.raisedFor === 'OTHER' ? (
                  <div className="field">
                    <label>Person (Contact Directory) *</label>
                    <AdaptiveSelect
                      required
                      threshold={1}
                      placeholder="Search contact…"
                      value={form.raisedForContactId}
                      onChange={(e) => pickRaisedForContact(e.target.value)}
                    >
                      <option value="">Search or select from Contact Directory</option>
                      {contacts.map((contact) => (
                        <option key={contact._id} value={contact._id}>
                          {contact.name || 'Unnamed'}
                          {contact.city ? `: ${contact.city}` : ''}
                        </option>
                      ))}
                    </AdaptiveSelect>
                  </div>
                ) : null}
                <div className="field">
                  <label>Associate this expense with a Client?</label>
                  <AdaptiveSelect
                    value={form.associateWithClient}
                    onChange={(e) => {
                      const associateWithClient = e.target.value === 'YES' ? 'YES' : 'NO';
                      setForm((prev) => ({
                        ...prev,
                        associateWithClient,
                        clientMasterId: associateWithClient === 'NO' ? '' : prev.clientMasterId,
                        clientId: associateWithClient === 'NO' ? '' : prev.clientId,
                        clientName: associateWithClient === 'NO' ? '' : prev.clientName,
                        clientCode: associateWithClient === 'NO' ? '' : prev.clientCode,
                        divisionTherapy: associateWithClient === 'NO' ? '' : prev.divisionTherapy,
                      }));
                    }}
                  >
                    <option value="NO">No</option>
                    <option value="YES">Yes</option>
                  </AdaptiveSelect>
                </div>
                {form.associateWithClient === 'YES' ? (
                  <div className="field">
                    <label>Code and Division / Therapy *</label>
                    <AdaptiveSelect
                      required
                      threshold={1}
                      placeholder="Search by code or division / therapy…"
                      value={form.clientMasterId}
                      onChange={(e) => pickExpenseClientMaster(e.target.value)}
                    >
                      <option value="">
                        {activeClientMasters.length
                          ? 'Search or select Code · Division / Therapy'
                          : 'No Client Master records available'}
                      </option>
                      {activeClientMasters.map((row) => (
                        <option key={row._id} value={row._id}>
                          {row.optionLabel}
                        </option>
                      ))}
                    </AdaptiveSelect>
                  </div>
                ) : null}
                <div className="field arq-span">
                  <label htmlFor="reimbursement-remarks">Remarks</label>
                  <textarea
                    id="reimbursement-remarks"
                    rows={3}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Optional notes about this expense"
                  />
                </div>
                <DateInput
                  label="Expense date *"
                  required
                  value={form.expenseDate}
                  onChange={(value) => setForm({ ...form, expenseDate: value })}
                />
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
                <div className="arq-service-top-row arq-span arq-hiring-loc-row">
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
                  <LocationCascade
                    required
                    showPin={false}
                    value={{
                      state: form.hiringState,
                      city: form.hiringCity,
                      district: form.hiringDistrict || '',
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
                        hiringStateId: loc.stateId || '',
                        hiringDistrictId: loc.districtId || '',
                        hiringCityId: loc.cityId || '',
                      })
                    }
                  />
                </div>
                <div className="arq-asset-reason-row arq-span">
                  <div className="field">
                    <label>Budget minimum (INR) *</label>
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
                    <label>Budget maximum (INR) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={form.budgetMax}
                      onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                    />
                  </div>
                  <div className="field arq-reason-field">
                    <label htmlFor="hiring-remarks">Remarks</label>
                    <input
                      id="hiring-remarks"
                      type="text"
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="Optional notes about this hiring request"
                    />
                  </div>
                </div>
              </>
            )}

            {/* -- Master One Request -- */}
            {form.requestType === 'MASTER_ADD' && (
              <>
                <div className="field arq-span">
                  <h4 className="arq-section-title">Master One Request</h4>
                  <p className="muted" style={{ margin: '0 0 var(--space-2)' }}>
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
                {form.masterEntity === 'contacts' && (
                  <div className="field arq-span">
                    <LocationCascade
                      required={false}
                      showPin
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
                            pinCode: loc.pinCode || '',
                          },
                        }))
                      }
                    />
                  </div>
                )}
                {form.masterEntity === 'pin-codes' && (
                  <div className="field arq-span">
                    <LocationCascade
                      required
                      pinFirst
                      pinInputOnly
                      pinRequired
                      districtRequired
                      showDistrict
                      showCity={false}
                      showZone
                      showMappedPinPreview
                      showPinCountsInOptions
                      value={{
                        pinCode: form.masterPayload?.pinCode || '',
                        state: form.masterPayload?.state || '',
                        district: form.masterPayload?.district || '',
                        zone: form.masterPayload?.zone || '',
                        stateId: form.masterPayload?.stateId || '',
                        districtId: form.masterPayload?.districtId || '',
                      }}
                      onChange={(loc) =>
                        setForm((prev) => ({
                          ...prev,
                          masterPayload: {
                            ...(prev.masterPayload || {}),
                            pinCode: loc.pinCode || '',
                            stateId: loc.stateId || '',
                            districtId: loc.districtId || '',
                            state: loc.state || '',
                            district: loc.district || '',
                            zone: loc.zone || '',
                          },
                        }))
                      }
                    />
                  </div>
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

            {needsAsset ? (
              <div className="arq-asset-reason-row arq-span">
                <div className="field">
                  <label>{FIELD.ASSET_NAME} *</label>
                  <AdaptiveSelect
                    required
                    threshold={1}
                    placeholder="Search asset name…"
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
                  <AdaptiveSelect
                    threshold={1}
                    placeholder="Search custodian…"
                    value={form.custodianName}
                    onChange={(e) => linkFromCustodianName(e.target.value)}
                  >
                    <option value="">Select</option>
                    {custodianNameOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                {!['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(form.requestType) ? (
                  <div className="field arq-reason-field">
                    <label>Remarks</label>
                    <input
                      type="text"
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="Add a short note"
                    />
                  </div>
                ) : null}
              </div>
            ) : !['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD'].includes(form.requestType) ? (
              <div className="field arq-reason-field">
                <label>Remarks</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Add a short note"
                />
              </div>
            ) : null}
          </div>
          {form.requestType === 'MASTER_ADD' || needsAsset ? (
            <p className="muted arq-hint">
              {form.requestType === 'MASTER_ADD'
                ? 'On approval, the requested master record is created automatically in Master One.'
                : 'Custodian details auto-fill when a unique asset match is found.'}
            </p>
          ) : null}
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
              <th>Request Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Details</th>
              <th>Asset</th>
              <th>Requestor</th>
              <th>Remarks</th>
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
                        r.hireeName ||
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
                      {r.requestType === 'HIRING' ? (
                        <>
                          {canApprove &&
                            userCanApproveType(r.requestType) &&
                            ['REQUESTED', 'APPROVED'].includes(r.status) &&
                            !isMine && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-compact"
                                  onClick={() => openFulfill(r)}
                                >
                                  Fulfill
                                </button>
                                {r.status === 'REQUESTED' && (
                                  <button
                                    type="button"
                                    className="btn secondary btn-compact"
                                    onClick={() => act(r._id, 'reject')}
                                  >
                                    Reject
                                  </button>
                                )}
                              </>
                            )}
                          {r.status === 'REQUESTED' && isMine && (
                            <span className="muted mono-sm">Awaiting fulfillment</span>
                          )}
                          {r.status === 'REQUESTED' &&
                            !isMine &&
                            canApprove &&
                            !userCanApproveType(r.requestType) && (
                            <span className="muted mono-sm">Awaiting Operations Leader</span>
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
                          {r.jdAttachment && (
                            <button
                              type="button"
                              className="btn secondary btn-compact"
                              onClick={() => openJd(r)}
                            >
                              View JD
                            </button>
                          )}
                          {!r.jdAttachment &&
                            isActive &&
                            (canApprove || (canRequest && isMine)) && (
                              <button
                                type="button"
                                className="btn secondary btn-compact"
                                onClick={() => {
                                  setJdFile(null);
                                  if (jdFileRef.current) jdFileRef.current.value = '';
                                  setJdUploadPrompt({
                                    id: r._id,
                                    requestNumber: r.requestNumber || r._id,
                                  });
                                }}
                              >
                                Upload JD
                              </button>
                            )}
                        </>
                      ) : (
                        <>
                      <WatchFollowButton entityType="AssetRequest" entityId={r._id} />
                      {canApprove &&
                        userCanApproveType(r.requestType) &&
                        r.status === 'REQUESTED' &&
                        !isMine && (
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
                      {r.status === 'REQUESTED' &&
                        !isMine &&
                        canApprove &&
                        !userCanApproveType(r.requestType) && (
                        <span className="muted mono-sm">
                          Awaiting {approvalRuleLabel(r.requestType)}
                        </span>
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
