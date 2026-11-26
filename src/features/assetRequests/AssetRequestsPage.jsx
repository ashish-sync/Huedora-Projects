import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  CircleDollarSign,
  Copy,
  Eye,
  FileText,
  Info,
  Link2,
  Package,
  Plus,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import FeedbackBanner, { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';
import { fetchContactsList } from '../../shared/contactsApi.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { productAssetName, productOptionLabel } from '../../shared/productMasterLabel.js';
import { FIELD, MODULE, ACTION } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import ModalShell from '../../components/ui/ModalShell.jsx';
import ContactDirectoryDrawer from '../agreements/ContactDirectoryDrawer.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import Button from '../../components/ui/Button.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { FALLBACK_PRODUCT } from '../logistics/logisticsTxnShared.jsx';
import { resolveProductType } from '../../shared/productTypes.js';
import { categoriesForType } from '../../shared/productMasterConfig.js';
import { isApprovalOverdue } from '../../shared/approvalTiming.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import '../notifications/notifications.css';
import '../assets/assetInventory.css';
import { approvalRuleLabel } from './requestApproval.js';
import {
  canCancelRequest,
  cancelRequiresRemark,
  canMutateRequestAttachments,
  canProcessRequest,
  canViewRequest,
  isRequestOwner,
} from './requestAccess.js';
import {
  canCreatorEditHiringDetails,
  hasOpenClarification,
  hiringProgressLabel,
  hiringUpdateKindLabel,
  requestDisplayStatus,
  hiringProgressOptionsForType,
  HIRING_UPDATE_KIND_OPTIONS,
} from './hiringUpdates.js';
import {
  canShowProcessAction,
  emptyProcessForm,
  logisticsUnfulfilledLineIds,
  processActionForType,
} from './requestProcessActions.js';
import {
  APPROVAL_AUTHORITY_LABEL,
  canActorApproveSubject,
  isApprovalAuthorityExempt,
} from '../../shared/approvalAuthority.js';
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
  parseClientMasterDivisions,
  resolveCampNameOptions,
  applyClientMasterCascade,
  pickSingleOption,
} from '../camps/utils/clientMasterCascade.js';
import { normalizeHealthcareWorkers } from '../camps/utils/healthcareWorkers.js';
import { isVendorContact } from '../agreements/contactPicklists.js';

const EMPTY_ARRAY = Object.freeze([]);

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
const TRANSPORT_MODES = ['Courier', 'Porter', 'Hand Delivery'];
const LOGISTICS_PRIORITIES = ['High', 'Medium', 'Low'];
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
const REQUEST_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'APPROVED', label: 'Accepted / Approved' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Refused' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

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
const DOCUMENT_MODEL_OPTIONS = categoriesForType('Document');

function isDocumentProductType(productType) {
  return resolveProductType(productType) === 'Document';
}

function emptyLogisticsProduct() {
  return { productType: '', productId: '', productName: '', qty: '', uomId: '' };
}

function isLogisticsProductRowComplete(item) {
  const hasModel = isDocumentProductType(item?.productType)
    ? Boolean(item?.productName)
    : Boolean(item?.productId && item?.productName);
  return Boolean(
    item?.productType &&
      hasModel &&
      item?.uomId &&
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
  logisticsPriority: 'Medium',
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
    { suffix: 'PinCode', label: 'Pin code', value: (c) => c.pinCode || '' },
    { suffix: 'Address', label: 'Address', value: (c) => c.address || '' },
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
            <div
              className={`field arq-contact-field arq-contact-field--${String(field.suffix).toLowerCase()}`}
              key={field.suffix}
            >
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

function pushDetail(rows, label, value) {
  const text = value == null ? '' : String(value).trim();
  if (!text) return;
  rows.push({ label, value: text });
}

/** Structured Details rows shown in the request info (i) panel. */
function requestDetailFields(r) {
  const rows = [];
  if (!r) return rows;

  pushDetail(rows, 'Type', displayType(r.requestType));

  if (r.requestType === 'REPAIR' || r.requestType === 'MAINTENANCE' || r.requestType === 'SERVICE') {
    pushDetail(
      rows,
      'Service',
      r.requestType === 'MAINTENANCE'
        ? 'Maintenance'
        : r.requestType === 'REPAIR'
          ? 'Repair'
          : r.serviceType || 'Service'
    );
    pushDetail(rows, 'Issue category', r.issueCategory || r.maintenanceKind);
    pushDetail(rows, 'Priority', r.priority);
    pushDetail(rows, 'Asset', r.assetName || r.trainingName);
    pushDetail(rows, 'Custody', r.assetCustody);
  }

  if (r.requestType === 'LOGISTICS') {
    pushDetail(rows, 'Issue kind', normalizeLogisticsKind(r.logisticsKind) || r.logisticsKind);
    pushDetail(rows, 'Transport mode', r.transportMode);
    pushDetail(rows, 'AWB number', r.awbNumber);
    pushDetail(rows, 'Priority', r.priority);
    pushDetail(
      rows,
      'Client',
      [r.clientName || r.clientCode, r.divisionTherapy, r.hiringMethod].filter(Boolean).join(' · ')
    );
    const logisticsProducts = Array.isArray(r.logisticsProducts) ? r.logisticsProducts : [];
    if (logisticsProducts.length) {
      pushDetail(
        rows,
        'Products',
        logisticsProducts
          .map((item) => `${item.productName || item.productType || 'Product'} ×${item.qty || 0}`)
          .join(', ')
      );
    }
    pushDetail(rows, 'Asset', r.assetName);
  }

  if (r.requestType === 'TRAINING') {
    pushDetail(rows, 'Topic', r.trainingTopic);
    pushDetail(rows, 'Training / asset', r.trainingName || r.assetName);
    pushDetail(rows, 'Trainee', r.traineeName);
    pushDetail(rows, 'Priority', r.priority);
  }

  if (r.requestType === 'REIMBURSEMENT') {
    pushDetail(
      rows,
      'Expense',
      [r.expenseCategory, r.expenseSubCategory].filter(Boolean).join(' · ')
    );
    pushDetail(
      rows,
      'Raised for',
      r.raisedFor === 'OTHER' || (r.payeeName && r.payeeName !== 'Self')
        ? r.payeeName || 'Other'
        : 'Self'
    );
    if (r.associateWithClient) {
      pushDetail(
        rows,
        'Client',
        [r.clientCode, r.divisionTherapy || r.clientName].filter(Boolean).join(' · ') || '-'
      );
    }
    if (r.amount != null && r.amount !== '') {
      pushDetail(rows, 'Amount', `${r.currency || 'INR'} ${r.amount}`);
    }
  }

  if (r.requestType === 'HIRING') {
    pushDetail(rows, 'Hiring type', r.hiringType);
    pushDetail(rows, 'HCW type', r.hcwType);
    pushDetail(rows, 'Camp type', r.campType);
    pushDetail(rows, 'Method', r.hiringMethod);
    pushDetail(rows, 'Name', r.hiringName || r.hireeName);
    pushDetail(
      rows,
      'Location',
      [r.hiringCity, r.hiringState, r.hiringPinCode].filter(Boolean).join(', ')
    );
    pushDetail(rows, 'Address', r.hiringAddress);
    if (r.engagementDateTime) {
      pushDetail(rows, 'Engagement', new Date(r.engagementDateTime).toLocaleString());
    }
    const budgetMin =
      r.budgetMin != null && r.budgetMin !== '' && Number.isFinite(Number(r.budgetMin))
        ? Number(r.budgetMin)
        : null;
    const budgetMax =
      r.budgetMax != null && r.budgetMax !== '' && Number.isFinite(Number(r.budgetMax))
        ? Number(r.budgetMax)
        : null;
    if (budgetMin != null || budgetMax != null) {
      const minLabel = budgetMin != null ? budgetMin.toLocaleString('en-IN') : '—';
      const maxLabel = budgetMax != null ? budgetMax.toLocaleString('en-IN') : '—';
      pushDetail(rows, 'Budget range', `INR ${minLabel} – ${maxLabel}`);
    }
    if (r.hireeName) {
      pushDetail(
        rows,
        'Assigned',
        `${r.hireeName}${r.hireeContact ? ` · ${r.hireeContact}` : ''}${
          r.payableAmount != null && r.payableAmount !== '' ? ` · ₹${r.payableAmount}` : ''
        }`
      );
    }
  }

  if (r.requestType === 'MASTER_ADD') {
    pushDetail(rows, 'Module', r.masterModule);
    pushDetail(
      rows,
      'Entity',
      getMasterEntity(r.masterEntity)?.label || r.masterEntity
    );
    pushDetail(rows, 'Created code', r.createdMasterCode);
  }

  if (r.requestType === 'OTHER') {
    pushDetail(rows, 'Category', r.otherCategory);
    pushDetail(rows, 'Subcategory', r.otherSubcategory);
    pushDetail(rows, 'Priority', r.priority);
    if (r.amount != null && r.amount !== '') {
      pushDetail(rows, 'Amount', `${r.currency || 'INR'} ${r.amount}`);
    }
  }

  pushDetail(rows, 'Remarks', r.reason);
  if (r.processAction) {
    pushDetail(rows, 'Process action', r.processAction);
    pushDetail(rows, 'UTR', r.processReference);
    if (r.processAmount != null && r.processAmount !== '') {
      pushDetail(rows, 'Amount paid', `${r.currency || 'INR'} ${r.processAmount}`);
    }
    pushDetail(rows, 'Scheduled', r.scheduledAt ? formatDateTime(r.scheduledAt) : '');
    pushDetail(rows, 'Venue / trainer', r.scheduleVenue);
    pushDetail(rows, 'Assignee', r.assigneeName);
    pushDetail(rows, 'Assignee phone', r.assigneeContact);
    pushDetail(rows, 'Issued at', r.issuedAt ? formatDateTime(r.issuedAt) : '');
    pushDetail(rows, 'Process remark', r.processRemark);
  }
  pushDetail(rows, 'Last update', formatDateTime(requestLastUpdateAt(r)));
  return rows;
}

function processActionIcon(requestType) {
  const key = String(requestType || '').toUpperCase();
  if (key === 'MASTER_ADD') return Plus;
  if (key === 'REIMBURSEMENT') return CircleDollarSign;
  if (key === 'TRAINING') return CalendarClock;
  if (key === 'LOGISTICS') return Package;
  if (key === 'REPAIR' || key === 'MAINTENANCE' || key === 'SERVICE') return UserCheck;
  return CheckCheck;
}

/** Work-log entries for the Request Actions tab. */
function buildRequestActionLog(r, hiringLogData) {
  if (!r) return [];
  const live = Array.isArray(hiringLogData?.updates) ? hiringLogData.updates : null;
  if (live && live.length) return live;
  const fromRow = Array.isArray(r.hiringUpdates) ? r.hiringUpdates : [];
  if (fromRow.length) return fromRow;

  const events = [];
  const pushEvent = (id, message, at, kind = 'STATUS') => {
    if (!at) return;
    events.push({
      id,
      kind,
      message,
      at,
      actorName: r.requestorId?.fullName || r.requestorId?.email || 'System',
    });
  };

  pushEvent('created', 'Request submitted', r.createdAt || r.requestedAt);
  pushEvent('approved', 'Request accepted', r.approvedAt);
  pushEvent('completed', 'Request closed', r.completedAt || r.fulfilledAt);
  const refuseRemark = String(r.rejectionReason || r.cancellationReason || '').trim();
  if (r.rejectedAt) {
    pushEvent(
      'rejected',
      refuseRemark ? `Request refused — ${refuseRemark}` : 'Request refused',
      r.rejectedAt
    );
  } else if (r.cancelledAt) {
    pushEvent(
      'cancelled',
      refuseRemark ? `Request refused — ${refuseRemark}` : 'Request refused',
      r.cancelledAt
    );
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function requestLastUpdateAt(r) {
  if (!r) return null;
  let latestHiringMs = 0;
  for (const entry of Array.isArray(r.hiringUpdates) ? r.hiringUpdates : []) {
    for (const raw of [entry?.at, entry?.resolvedAt]) {
      if (!raw) continue;
      const ms = new Date(raw).getTime();
      if (Number.isFinite(ms) && ms > latestHiringMs) latestHiringMs = ms;
    }
  }
  const candidates = [
    latestHiringMs || null,
    r.updatedAt,
    r.completedAt,
    r.fulfilledAt,
    r.rejectedAt,
    r.cancelledAt,
    r.approvedAt,
    r.createdAt,
    r.requestedAt,
  ].filter(Boolean);
  let best = null;
  let bestMs = 0;
  for (const raw of candidates) {
    const ms = typeof raw === 'number' ? raw : new Date(raw).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = typeof raw === 'number' ? new Date(raw) : raw;
    }
  }
  return best;
}

export default function AssetRequestsPage() {
  const { can, user, canDelete } = useAuth();
  const { options: hcwTypeOptions } = usePicklistOptions('hiring.hcwType', HCW_TYPES);
  const { options: hiringMethodOptions } = usePicklistOptions('hiring.method', HIRING_METHODS);
  const [searchParams] = useSearchParams();
  const canRequest =
    can('asset-requests:request') ||
    can('movements:request') ||
    can('repairs:write') ||
    can('maintenance:write') ||
    can('*');
  const canDeleteRequests = canDelete();
  const authorityExempt = isApprovalAuthorityExempt(user, can);
  const userCanApproveRow = (row) => {
    const subject =
      row?.requestorId && typeof row.requestorId === 'object'
        ? row.requestorId
        : { _id: row?.requestorId };
    return canActorApproveSubject(user, subject, can);
  };
  const userCanProcessRow = (row) => canProcessRequest(user, can, row);
  const userCanCancelRow = (row) => canCancelRequest(user, can, row);
  const userCanMutateAttachments = (row) => canMutateRequestAttachments(user, can, row);

  const [rows, setRows] = useState([]);
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [assets, setAssets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [vendorContacts, setVendorContacts] = useState([]);
  const [logisticsMeta, setLogisticsMeta] = useState(null);
  const [expenseMaster, setExpenseMaster] = useState({ expenseCategories: [], expenseSubCategories: [] });
  const [clients, setClients] = useState([]);
  const [clientMasters, setClientMasters] = useState([]);
  const [logisticsDivisionPrograms, setLogisticsDivisionPrograms] = useState([]);
  const [logisticsDivisionOptions, setLogisticsDivisionOptions] = useState([]);
  const [logisticsProgramsLoading, setLogisticsProgramsLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
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
  const [fulfillBusy, setFulfillBusy] = useState(false);
  const [processTarget, setProcessTarget] = useState(null);
  const [processForm, setProcessForm] = useState(emptyProcessForm());
  const [processBusy, setProcessBusy] = useState(false);
  const [hiringUpdateForm, setHiringUpdateForm] = useState({
    kind: 'STATUS',
    progress: 'IN_PROGRESS',
    message: '',
  });
  const [hiringUpdateBusy, setHiringUpdateBusy] = useState(false);
  const [hiringLogTarget, setHiringLogTarget] = useState(null);
  const [hiringLogData, setHiringLogData] = useState(null);
  const [hiringLogLoading, setHiringLogLoading] = useState(false);
  const [requestInfoTab, setRequestInfoTab] = useState('details');
  const [hiringReply, setHiringReply] = useState('');
  const [hiringDetailForm, setHiringDetailForm] = useState({
    reason: '',
    hiringAddress: '',
    hiringCity: '',
    hiringState: '',
    hiringPinCode: '',
    engagementDateTime: '',
  });
  const [hiringLogBusy, setHiringLogBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
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
    const focusId = String(
      searchParams.get('requestId') || searchParams.get('movementId') || ''
    ).trim();
    if (!focusId) return;
    setMsg(`Opened from notification: request ${focusId}`);
    setTypeFilter('LOGISTICS');
  }, [searchParams]);

  useEffect(() => {
    const requestType = String(searchParams.get('type') || '').toUpperCase();
    const campRecordId = String(searchParams.get('campRecordId') || '').trim();
    if (requestType === 'HIRING' && campRecordId) {
      setFormOpen(true);
    }
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
  // Prefer client SSOT so new categories (e.g. Document) show even if /logistics/meta is stale
  const logisticsProductTypes = FALLBACK_PRODUCT;
  const logisticsProducts = logisticsMeta?.products || EMPTY_ARRAY;
  const logisticsUoms = logisticsMeta?.uoms || EMPTY_ARRAY;
  const trainingDeviceProducts = useMemo(
    () =>
      logisticsProducts.filter(
        (product) =>
          product?.isActive !== false && ASSET_PRODUCT_TYPES.has(String(product.productType || ''))
      ),
    [logisticsProducts]
  );
  const expenseCategories = expenseMaster.expenseCategories || EMPTY_ARRAY;
  const expenseSubCategories = expenseMaster.expenseSubCategories || EMPTY_ARRAY;

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
            optionLabel: [code || '-', division || '-'].join(' · '),
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

  const logisticsMethodOptions = useMemo(
    () =>
      resolveCampNameOptions(
        logisticsDivisionPrograms,
        form.divisionTherapy,
        form.hiringMethod
      ),
    [logisticsDivisionPrograms, form.divisionTherapy, form.hiringMethod]
  );

  useEffect(() => {
    if (form.requestType !== 'LOGISTICS' || !form.clientId) {
      setLogisticsDivisionPrograms([]);
      setLogisticsDivisionOptions([]);
      setLogisticsProgramsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLogisticsProgramsLoading(true);
    clientMasterApi
      .listDivisionsByClient(
        form.clientId,
        form.clientName ? { clientName: form.clientName } : undefined
      )
      .then(({ data }) => {
        if (cancelled) return;
        const { programs, divisions } = parseClientMasterDivisions(data);
        setLogisticsDivisionPrograms(programs);
        setLogisticsDivisionOptions(divisions);
        setForm((prev) => {
          if (prev.requestType !== 'LOGISTICS') return prev;
          const cascaded = applyClientMasterCascade({
            programs,
            currentDivision: prev.divisionTherapy,
            currentMethod: prev.hiringMethod,
          });
          if (
            cascaded.campaignType === prev.divisionTherapy &&
            cascaded.campaignName === prev.hiringMethod
          ) {
            return prev;
          }
          return {
            ...prev,
            divisionTherapy: cascaded.campaignType,
            hiringMethod: cascaded.campaignName,
          };
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLogisticsDivisionPrograms([]);
          setLogisticsDivisionOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLogisticsProgramsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.requestType, form.clientId, form.clientName]);

  const pickLogisticsClient = (clientId) => {
    const client = clientsById.get(String(clientId));
    setForm((prev) => ({
      ...prev,
      clientId,
      clientName: client?.name || '',
      clientCode: client?.code || '',
      clientMasterId: '',
      divisionTherapy: '',
      hiringMethod: '',
    }));
  };

  const pickLogisticsDivision = (divisionTherapy) => {
    const methods = resolveCampNameOptions(logisticsDivisionPrograms, divisionTherapy);
    setForm((prev) => ({
      ...prev,
      divisionTherapy,
      hiringMethod: pickSingleOption(methods),
      clientMasterId: '',
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

  const buildListQuery = ({ forExport = false } = {}) => {
    const params = new URLSearchParams();
    if (!forExport) {
      params.set('page', String(page));
      params.set('limit', String(limit));
    }
    if (typeFilter) params.set('requestType', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (String(debouncedQ || '').trim()) params.set('q', String(debouncedQ).trim());
    if (appliedDateFrom) params.set('dateFrom', appliedDateFrom);
    if (appliedDateTo) params.set('dateTo', appliedDateTo);
    return params;
  };

  const load = () => {
    setListLoading(true);
    const params = buildListQuery();
    api(`/asset-requests?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setListMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  };

  const openCreate = () => {
    if (!canRequest) return;
    setError('');
    setMsg('');
    setFormOpen(true);
  };

  const closeCreate = () => {
    if (busy) return;
    setFormOpen(false);
  };

  const setCreatedFrom = (value) => {
    setDateFrom(value);
    setAppliedDateFrom(value);
    setPage(1);
  };

  const setCreatedTo = (value) => {
    setDateTo(value);
    setAppliedDateTo(value);
    setPage(1);
  };

  const clearListFilters = () => {
    setQ('');
    setTypeFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setPage(1);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeFilter, statusFilter, debouncedQ, appliedDateFrom, appliedDateTo]);

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
      fetchContactsList({ limit: 100 })
        .then((rows) => {
          if (!cancelled) setContacts(rows);
        })
        .catch(() => {});
    }
    if (needsVendors) {
      fetchContactsList({ limit: 100, contactCategory: 'Vendor' })
        .then((rows) => {
          if (!cancelled) setVendorContacts(rows.filter((c) => isVendorContact(c)));
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
      ...(requestType === 'LOGISTICS'
        ? {
            clientMasterId: '',
            clientId: '',
            clientName: '',
            clientCode: '',
            divisionTherapy: '',
            hiringMethod: '',
            reason: '',
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
            uomId: product.uomId ? String(product.uomId) : '',
          }
        : { productId: '', productName: '', uomId: '' }
    );
  };

  const selectDocumentModel = (index, productName) => {
    const name = String(productName || '').trim();
    const duplicate = form.logisticsProducts.some(
      (item, itemIndex) =>
        itemIndex !== index &&
        isDocumentProductType(item.productType) &&
        String(item.productName || '').trim() === name
    );
    if (name && duplicate) {
      setError('The same document type cannot be added more than once.');
      return;
    }
    setError('');
    updateLogisticsProduct(index, {
      productId: '',
      productName: name,
      uomId: form.logisticsProducts[index]?.uomId || '',
    });
  };

  const addLogisticsProduct = () => {
    const incomplete = form.logisticsProducts.some((item) => !isLogisticsProductRowComplete(item));
    if (incomplete) {
      setError('Fill Product category, Model/Variant/Name, Qty, and UOM before adding another product.');
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
      setError('Complete every goods issue product row with quantity and UOM.');
      return;
    }
    const productIds = form.logisticsProducts
      .filter((item) => !isDocumentProductType(item.productType))
      .map((item) => String(item.productId));
    if (new Set(productIds).size !== productIds.length) {
      setError('The same product cannot be added more than once.');
      return;
    }
    const documentNames = form.logisticsProducts
      .filter((item) => isDocumentProductType(item.productType))
      .map((item) => String(item.productName || '').trim().toLowerCase());
    if (new Set(documentNames).size !== documentNames.length) {
      setError('The same document type cannot be added more than once.');
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
      setError('Complete every goods issue product row with quantity and UOM.');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !form.logisticsProductsConfirmed) {
      setError('Confirm the selected products before choosing contacts and submitting.');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !form.transportMode) {
      setError('Select a delivery mode.');
      return;
    }
    if (
      form.requestType === 'LOGISTICS' &&
      !LOGISTICS_PRIORITIES.includes(String(form.logisticsPriority || '').trim())
    ) {
      setError('Select priority (High, Medium, or Low).');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !form.clientId) {
      setError('Select a client name for this Goods Issuance Request.');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !String(form.divisionTherapy || '').trim()) {
      setError('Select Division / Therapy for this Goods Issuance Request.');
      return;
    }
    if (form.requestType === 'LOGISTICS' && !String(form.hiringMethod || '').trim()) {
      setError('Select Method for this Goods Issuance Request.');
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
        body.priority = form.logisticsPriority || undefined;
        body.clientId = form.clientId || undefined;
        body.clientName = form.clientName || undefined;
        body.clientCode = form.clientCode || undefined;
        body.clientMasterId = form.clientMasterId || undefined;
        body.divisionTherapy = form.divisionTherapy || undefined;
        body.hiringMethod = form.hiringMethod || undefined;
        body.logisticsProducts = form.logisticsProducts.map((item) => ({
          productType: item.productType,
          productId: isDocumentProductType(item.productType)
            ? undefined
            : item.productId || undefined,
          productName: item.productName,
          qty: Number(item.qty),
          uomId: item.uomId || undefined,
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
        logisticsPriority: 'Medium',
        logisticsProducts: [emptyLogisticsProduct()],
        logisticsProductsConfirmed: false,
      });
      setReimbursementBill(null);
      setOtherAttachment(null);
      if (reimbursementBillRef.current) reimbursementBillRef.current.value = '';
      if (otherAttachmentRef.current) otherAttachmentRef.current.value = '';
      setMsg(savedMessage);
      setFormOpen(false);
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

  const cancelRequest = (request) => {
    setCancelReason('');
    setCancelConfirmTarget(request);
  };

  const handleConfirmCancelRequest = async () => {
    if (!cancelConfirmTarget) return;
    const req = cancelConfirmTarget;
    const remark = String(cancelReason || '').trim();
    if (cancelRequiresRemark(user, req) && !remark) {
      setError('Enter a remark before cancelling your request.');
      return;
    }
    setCancelBusy(true);
    setError('');
    setMsg('');
    try {
      await api(`/asset-requests/${req._id}/cancel`, {
        method: 'POST',
        body: { reason: remark || undefined, cancellationReason: remark || undefined },
      });
      setMsg(`Request ${req.requestNumber || req._id} cancelled.`);
      setCancelConfirmTarget(null);
      setCancelReason('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelBusy(false);
    }
  };

  const requestDeleteRequest = (request) => {
    if (!canDeleteRequests || !request?._id) return;
    setDeleteConfirmTarget(request);
  };

  const handleConfirmDeleteRequest = async () => {
    if (!deleteConfirmTarget?._id || !canDeleteRequests) return;
    const req = deleteConfirmTarget;
    setDeleteBusy(true);
    setError('');
    setMsg('');
    try {
      await api(`/asset-requests/${req._id}/delete`, { method: 'POST', body: {} });
      setMsg(`Request ${req.requestNumber || req._id} deleted.`);
      setDeleteConfirmTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete request');
    } finally {
      setDeleteBusy(false);
    }
  };

  const openReject = (request, mode = 'reject') => {
    setError('');
    setRejectReason('');
    setRejectTarget({
      id: request._id,
      requestNumber: request.requestNumber || request._id,
      requestType: request.requestType,
      mode: mode === 'cancel' ? 'cancel' : 'reject',
    });
  };

  const closeReject = () => {
    if (rejectBusy) return;
    setRejectTarget(null);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectTarget?.id) return;
    const reason = String(rejectReason || '').trim();
    if (!reason) {
      setError('Enter a remark before refusing this request.');
      return;
    }
    setError('');
    setRejectBusy(true);
    try {
      if (rejectTarget.mode === 'cancel') {
        await api(`/asset-requests/${rejectTarget.id}/cancel`, {
          method: 'POST',
          body: { reason, cancellationReason: reason },
        });
      } else {
        await api(`/asset-requests/${rejectTarget.id}/reject`, {
          method: 'POST',
          body: { reason, rejectionReason: reason },
        });
      }
      setMsg(`Request ${rejectTarget.requestNumber} refused.`);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRejectBusy(false);
    }
  };

  const openFulfill = (request) => {
    if (fulfillBusy) return;
    setError('');
    setFulfillTarget({
      id: request._id,
      requestNumber: request.requestNumber || request._id,
    });
  };

  const openProcess = (request) => {
    if (processBusy) return;
    const action = processActionForType(request.requestType);
    if (!action) return;
    setError('');
    setProcessForm(emptyProcessForm(request));
    setProcessTarget(request);
  };

  const closeProcess = () => {
    if (processBusy) return;
    setProcessTarget(null);
    setProcessForm(emptyProcessForm());
  };

  const submitProcess = async (e) => {
    e?.preventDefault?.();
    if (!processTarget?._id || processBusy) return;
    const action = processActionForType(processTarget.requestType);
    if (!action) return;
    setProcessBusy(true);
    setError('');
    setMsg('');
    try {
      if (action.usesApprove) {
        const processRemark = String(processForm.processRemark || '').trim();
        if (!processRemark) {
          setError('Remark is required.');
          setProcessBusy(false);
          return;
        }
        await api(`/asset-requests/${processTarget._id}/approve`, {
          method: 'POST',
          body: { processRemark },
        });
        setMsg(`Request ${processTarget.requestNumber || processTarget._id} added.`);
      } else {
        const type = String(processTarget.requestType || '').toUpperCase();
        const body = { processRemark: String(processForm.processRemark || '').trim() };
        if (type === 'REIMBURSEMENT') {
          body.processReference = String(processForm.processReference || '').trim();
          body.processAmount = processForm.processAmount;
          body.utr = body.processReference;
          if (!body.processReference) {
            setError('UTR is required.');
            setProcessBusy(false);
            return;
          }
          const paid = Number(body.processAmount);
          if (!Number.isFinite(paid) || paid <= 0) {
            setError('Exact payment amount is required and must be greater than zero.');
            setProcessBusy(false);
            return;
          }
        } else if (type === 'TRAINING') {
          body.scheduledAt = String(processForm.scheduledAt || '').trim();
          body.scheduleVenue = String(processForm.scheduleVenue || '').trim();
        } else if (type === 'LOGISTICS') {
          body.issueNote = String(processForm.processRemark || '').trim();
          body.transportMode = String(processForm.transportMode || '').trim();
          body.awbNumber = String(processForm.awbNumber || '').trim();
          if (!body.transportMode) {
            setError('Mode of delivery is required.');
            setProcessBusy(false);
            return;
          }
          if (body.transportMode === 'Courier' && !body.awbNumber) {
            setError('AWB number is required for Courier.');
            setProcessBusy(false);
            return;
          }
          if (!body.issueNote) {
            setError('Issue note is required.');
            setProcessBusy(false);
            return;
          }
          const remaining = logisticsUnfulfilledLineIds(processTarget);
          if (remaining.length) {
            setError(
              `Issue all product lines in Movement One before completing this request (${remaining.length} line(s) still pending).`
            );
            setProcessBusy(false);
            return;
          }
        } else if (type === 'REPAIR' || type === 'MAINTENANCE' || type === 'SERVICE') {
          body.assigneeName = String(processForm.assigneeName || '').trim();
          body.assigneeContact = String(processForm.assigneeContact || '').trim();
        }
        await api(`/asset-requests/${processTarget._id}/process`, {
          method: 'POST',
          body,
        });
        setMsg(
          `Request ${processTarget.requestNumber || processTarget._id}: ${action.label}.`
        );
      }
      setProcessTarget(null);
      setProcessForm(emptyProcessForm());
      await load();
    } catch (err) {
      setError(err.message || 'Could not process request');
    } finally {
      setProcessBusy(false);
    }
  };

  const resetHiringUpdateForm = (request) => {
    const current = String(request?.hiringProgress || '').toUpperCase();
    const progress = ['IN_PROGRESS', 'AWAITING_INFO', 'ON_HOLD'].includes(current)
      ? current
      : 'IN_PROGRESS';
    setHiringUpdateForm({
      kind: 'STATUS',
      progress,
      message: '',
    });
  };

  const submitHiringUpdate = async (e) => {
    e?.preventDefault?.();
    if (!hiringLogTarget?._id) return;
    const kind = hiringUpdateForm.kind === 'CLARIFICATION' ? 'CLARIFICATION' : 'STATUS';
    const progress = hiringUpdateForm.progress;
    const message =
      kind === 'STATUS'
        ? `Status updated to ${hiringProgressLabel(progress)}.`
        : String(hiringUpdateForm.message || '').trim();
    if (kind === 'CLARIFICATION' && !message) {
      setError('Enter a short clarification question.');
      return;
    }
    setHiringUpdateBusy(true);
    setError('');
    setMsg('');
    try {
      await api(`/asset-requests/${hiringLogTarget._id}/hiring-updates`, {
        method: 'POST',
        body: {
          kind,
          message,
          progress: kind === 'STATUS' ? progress : undefined,
        },
      });
      const closedAsHcwExists = kind === 'STATUS' && progress === 'HCW_EXISTS';
      setMsg(
        closedAsHcwExists
          ? `Request ${hiringLogTarget.requestNumber || hiringLogTarget._id} closed — HCW Exists.`
          : kind === 'STATUS'
            ? `Status updated on ${hiringLogTarget.requestNumber || hiringLogTarget._id}.`
            : `Clarification sent on ${hiringLogTarget.requestNumber || hiringLogTarget._id}.`
      );
      resetHiringUpdateForm(hiringLogTarget);
      const res = await api(`/asset-requests/${hiringLogTarget._id}/hiring-updates`);
      const payload = res?.data && typeof res.data === 'object' ? res.data : res;
      setHiringLogData(payload || null);
      if (payload?.status) {
        setHiringLogTarget((prev) =>
          prev ? { ...prev, status: payload.status, hiringProgress: payload.hiringProgress } : prev
        );
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setHiringUpdateBusy(false);
    }
  };

  const openHiringLog = async (request) => {
    setError('');
    setHiringLogTarget(request);
    setRequestInfoTab(hasOpenClarification(request) ? 'actions' : 'details');
    setHiringReply('');
    resetHiringUpdateForm(request);
    setHiringDetailForm({
      reason: request.reason || '',
      hiringAddress: request.hiringAddress || '',
      hiringCity: request.hiringCity || '',
      hiringState: request.hiringState || '',
      hiringPinCode: request.hiringPinCode || '',
      engagementDateTime: request.engagementDateTime || '',
    });
    setHiringLogData({
      status: request.status,
      rejectionReason: request.rejectionReason || '',
      cancellationReason: request.cancellationReason || '',
      rejectedAt: request.rejectedAt || null,
      cancelledAt: request.cancelledAt || null,
      hiringProgress: request.hiringProgress || 'OPEN',
      updates: Array.isArray(request.hiringUpdates) ? request.hiringUpdates : [],
    });
    setHiringLogLoading(true);
    try {
      const res = await api(`/asset-requests/${request._id}/hiring-updates`);
      const payload = res?.data && typeof res.data === 'object' ? res.data : res;
      if (payload && typeof payload === 'object') {
        setHiringLogData({
          status: payload.status || request.status,
          rejectionReason: payload.rejectionReason || request.rejectionReason || '',
          cancellationReason:
            payload.cancellationReason || request.cancellationReason || '',
          rejectedAt: payload.rejectedAt || request.rejectedAt || null,
          cancelledAt: payload.cancelledAt || request.cancelledAt || null,
          hiringProgress: payload.hiringProgress || request.hiringProgress || 'OPEN',
          updates: Array.isArray(payload.updates)
            ? payload.updates
            : Array.isArray(request.hiringUpdates)
              ? request.hiringUpdates
              : [],
        });
      }
    } catch (err) {
      // Keep the panel open with row-local details if the log fetch fails.
      setError(err.message || 'Could not refresh the request work log.');
    } finally {
      setHiringLogLoading(false);
    }
  };

  const closeHiringLog = () => {
    if (hiringLogBusy || hiringUpdateBusy) return;
    setHiringLogTarget(null);
    setHiringLogData(null);
    setHiringReply('');
    setRequestInfoTab('details');
    resetHiringUpdateForm(null);
  };

  const submitHiringReply = async ({ withDetails = false } = {}) => {
    if (!hiringLogTarget?._id) return;
    const reply = String(hiringReply || '').trim();
    if (!withDetails && !reply) {
      setError('Enter a reply message.');
      return;
    }
    setHiringLogBusy(true);
    setError('');
    setMsg('');
    try {
      if (withDetails) {
        await api(`/asset-requests/${hiringLogTarget._id}/hiring-details`, {
          method: 'PATCH',
          body: {
            ...hiringDetailForm,
            message: reply || undefined,
          },
        });
        setMsg('Hiring details updated.');
      } else {
        await api(`/asset-requests/${hiringLogTarget._id}/hiring-updates`, {
          method: 'POST',
          body: { kind: 'REPLY', message: reply },
        });
        setMsg('Reply sent.');
      }
      const res = await api(`/asset-requests/${hiringLogTarget._id}/hiring-updates`);
      setHiringLogData(res.data || null);
      setHiringReply('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setHiringLogBusy(false);
    }
  };

  const closeFulfill = () => {
    if (fulfillBusy) return;
    setFulfillTarget(null);
  };

  const handleAssignContactSaved = async (contact) => {
    if (!fulfillTarget?.id) return;
    const hireeName = String(contact?.name || '').trim();
    const hireeContact = String(contact?.contact || contact?.mobile || '').trim();
    if (!hireeName || !hireeContact) {
      setError('Saved contact needs a name and phone number to assign this request.');
      throw new Error('Saved contact needs a name and phone number to assign this request.');
    }
    setError('');
    setFulfillBusy(true);
    try {
      await api(`/asset-requests/${fulfillTarget.id}/fulfill`, {
        method: 'POST',
        body: { hireeName, hireeContact },
      });
      setMsg(`Request ${fulfillTarget.requestNumber} assigned.`);
      setFulfillTarget(null);
      await load();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setFulfillBusy(false);
    }
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      const params = buildListQuery({ forExport: true });
      const qs = params.toString();
      await downloadExcel(
        `/asset-requests/export${qs ? `?${qs}` : ''}`,
        'Request_One.xlsx'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === 'REQUESTED').length;
  const headerActions = (
    <div className="inv-header-actions">
      <button
        className="btn btn-compact"
        type="button"
        disabled={exportBusy}
        onClick={downloadMaster}
      >
        {exportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD}
      </button>
      {canRequest ? (
        <button className="btn btn-compact" type="button" onClick={openCreate}>
          + New request
        </button>
      ) : null}
    </div>
  );

  return (
    <PageShell
      className="arq-page"
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ASSET_REQUESTS }]}
      title={MODULE.ASSET_REQUESTS}
      description="Raise and manage Repair & Service, Goods Issuance, Training, Finance, Hiring, Master One, and Other requests."
      actions={headerActions}
      kpis={[
        { label: 'Total requests', value: listMeta.total || 0 },
        { label: 'Pending (this page)', value: pending },
      ]}
    >
      <FeedbackAlerts error={error} message={msg} />

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

      <ContactDirectoryDrawer
        open={Boolean(fulfillTarget)}
        onClose={closeFulfill}
        contact={null}
        defaultCategory="Healthcare Worker"
        canWrite
        onSaved={handleAssignContactSaved}
      />

      <ModalShell
        open={Boolean(processTarget)}
        onClose={closeProcess}
        title={
          processTarget
            ? `${processActionForType(processTarget.requestType)?.label || 'Process'} · ${
                processTarget.requestNumber || processTarget._id
              }`
            : 'Process request'
        }
        titleId="arq-process-title"
        panelClassName="modal-card modal-card--sm arq-process-panel"
        closeOnOverlayClick={!processBusy}
      >
        {processTarget ? (
          <form className="arq-process-form" onSubmit={submitProcess} noValidate>
            <p className="muted mono-sm arq-process-form__lead">
              {displayType(processTarget.requestType)}
            </p>
            {error ? <p className="error arq-process-form__error">{error}</p> : null}

            {processTarget.requestType === 'MASTER_ADD' ? (
              <>
                <dl className="arq-request-details">
                  <div className="arq-request-details__row">
                    <dt>Module</dt>
                    <dd>{processTarget.masterModule || '-'}</dd>
                  </div>
                  <div className="arq-request-details__row">
                    <dt>Entity</dt>
                    <dd>
                      {getMasterEntity(processTarget.masterEntity)?.label ||
                        processTarget.masterEntity ||
                        '-'}
                    </dd>
                  </div>
                </dl>
                <div className="field">
                  <label htmlFor="arq-process-remark">Remark *</label>
                  <textarea
                    id="arq-process-remark"
                    className="field-input"
                    required
                    rows={3}
                    value={processForm.processRemark}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processRemark: e.target.value }))
                    }
                    placeholder="Confirm why this master record is being added"
                  />
                </div>
              </>
            ) : null}

            {processTarget.requestType === 'REIMBURSEMENT' ? (
              <>
                {processTarget.amount != null && processTarget.amount !== '' ? (
                  <p className="muted mono-sm">
                    Claimed amount: {processTarget.currency || 'INR'} {processTarget.amount}
                  </p>
                ) : null}
                <div className="field">
                  <label htmlFor="arq-process-amount">Exact amount paid *</label>
                  <input
                    id="arq-process-amount"
                    className="field-input"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={processForm.processAmount}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processAmount: e.target.value }))
                    }
                    placeholder="Confirm amount actually paid"
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-ref">UTR *</label>
                  <input
                    id="arq-process-ref"
                    className="field-input"
                    required
                    value={processForm.processReference}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processReference: e.target.value }))
                    }
                    placeholder="Enter UTR number"
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-remark">Remark</label>
                  <input
                    id="arq-process-remark"
                    className="field-input"
                    value={processForm.processRemark}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processRemark: e.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {processTarget.requestType === 'TRAINING' ? (
              <>
                <div className="field">
                  <label htmlFor="arq-process-schedule">Schedule date/time *</label>
                  <input
                    id="arq-process-schedule"
                    className="field-input"
                    required
                    type="datetime-local"
                    value={processForm.scheduledAt}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-venue">Venue / trainer *</label>
                  <input
                    id="arq-process-venue"
                    className="field-input"
                    required
                    value={processForm.scheduleVenue}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, scheduleVenue: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-remark">Remark</label>
                  <input
                    id="arq-process-remark"
                    className="field-input"
                    value={processForm.processRemark}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processRemark: e.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {processTarget.requestType === 'LOGISTICS' ? (
              <>
                {(Array.isArray(processTarget.logisticsProducts)
                  ? processTarget.logisticsProducts
                  : []
                ).length ? (
                  <ul className="arq-process-lines muted mono-sm">
                    {processTarget.logisticsProducts.map((item, idx) => (
                      <li key={item.lineId || idx}>
                        {item.productName || item.productType || 'Product'} ×{item.qty || 0}
                        {item.uom ? ` ${item.uom}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted mono-sm">No product lines on this request.</p>
                )}
                {(() => {
                  const pendingLines = logisticsUnfulfilledLineIds(processTarget);
                  if (!pendingLines.length) return null;
                  return (
                    <p className="error mono-sm">
                      Product lines must be issued in Movement One before you can click Issue here (
                      {pendingLines.length} pending).
                    </p>
                  );
                })()}
                <div className="field">
                  <label htmlFor="arq-process-delivery-mode">Mode of delivery *</label>
                  <select
                    id="arq-process-delivery-mode"
                    className="field-input adaptive-select"
                    required
                    value={processForm.transportMode}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({
                        ...prev,
                        transportMode: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select mode</option>
                    {TRANSPORT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="arq-process-awb">
                    AWB number{processForm.transportMode === 'Courier' ? ' *' : ''}
                  </label>
                  <input
                    id="arq-process-awb"
                    className="field-input"
                    required={processForm.transportMode === 'Courier'}
                    value={processForm.awbNumber}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, awbNumber: e.target.value }))
                    }
                    placeholder={
                      processForm.transportMode === 'Courier'
                        ? 'Enter AWB / tracking number'
                        : 'Optional for this mode'
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-remark">Issue note *</label>
                  <textarea
                    id="arq-process-remark"
                    className="field-input"
                    required
                    rows={3}
                    value={processForm.processRemark}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processRemark: e.target.value }))
                    }
                    placeholder="Confirm issue / dispatch details"
                  />
                </div>
              </>
            ) : null}

            {['REPAIR', 'MAINTENANCE', 'SERVICE'].includes(processTarget.requestType) ? (
              <>
                <div className="field">
                  <label htmlFor="arq-process-assignee">Assignee name *</label>
                  <input
                    id="arq-process-assignee"
                    className="field-input"
                    required
                    value={processForm.assigneeName}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, assigneeName: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-phone">Phone *</label>
                  <input
                    id="arq-process-phone"
                    className="field-input"
                    required
                    inputMode="tel"
                    value={processForm.assigneeContact}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, assigneeContact: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="arq-process-remark">Remark</label>
                  <input
                    id="arq-process-remark"
                    className="field-input"
                    value={processForm.processRemark}
                    disabled={processBusy}
                    onChange={(e) =>
                      setProcessForm((prev) => ({ ...prev, processRemark: e.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {processTarget.requestType === 'OTHER' ? (
              <div className="field">
                <label htmlFor="arq-process-remark">Completion remark *</label>
                <textarea
                  id="arq-process-remark"
                  className="field-input"
                  required
                  rows={3}
                  value={processForm.processRemark}
                  disabled={processBusy}
                  onChange={(e) =>
                    setProcessForm((prev) => ({ ...prev, processRemark: e.target.value }))
                  }
                  placeholder="How was this request completed?"
                />
              </div>
            ) : null}

            <div className="arq-process-form__actions">
              <button
                type="button"
                className="btn secondary"
                disabled={processBusy}
                onClick={closeProcess}
              >
                Cancel
              </button>
              <button type="submit" className="btn" disabled={processBusy}>
                {processBusy
                  ? 'Saving…'
                  : processActionForType(processTarget.requestType)?.label || 'Save'}
              </button>
            </div>
          </form>
        ) : null}
      </ModalShell>

      {canRequest && formOpen ? (
        <>
          <div
            className="cd-drawer-backdrop"
            onClick={() => !busy && closeCreate()}
            aria-hidden="true"
          />
          <aside
            className="cd-drawer cd-drawer--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arq-drawer-heading"
            aria-label="New request"
          >
            <div className="cd-drawer-header">
              <div className="cd-drawer-header-copy">
                <span className="cd-drawer-kicker">New Request Record</span>
                <h3 id="arq-drawer-heading" className="cd-drawer-title">
                  New request
                </h3>
              </div>
              <button
                type="button"
                className="cd-drawer-close-btn"
                onClick={() => !busy && closeCreate()}
                aria-label="Close drawer"
                title="Close"
                disabled={busy}
              >
                ×
              </button>
            </div>
            <form
              ref={formRef}
              className="cd-drawer-form arq-form"
              onSubmit={submit}
              autoComplete="off"
              data-form-type="other"
            >
              <div className="cd-drawer-scroll">
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
                    placeholder="Optional: search Contact Directory…"
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
                <div className="field">
                  <label>Priority *</label>
                  <AdaptiveSelect
                    required
                    value={form.logisticsPriority}
                    onChange={(e) => setForm({ ...form, logisticsPriority: e.target.value })}
                  >
                    <option value="">Select priority</option>
                    {LOGISTICS_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
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
            ) : form.requestType === 'MASTER_ADD' ? (
              <div className="arq-finance-meta-row arq-span">
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
                      const isDocument = isDocumentProductType(item.productType);
                      const selectedElsewhere = new Set(
                        form.logisticsProducts
                          .filter((_, itemIndex) => itemIndex !== index)
                          .map((row) => String(row.productId))
                          .filter(Boolean)
                      );
                      const matchingProducts = logisticsProducts.filter(
                        (product) =>
                          (!item.productType ||
                            resolveProductType(product.productType) ===
                              resolveProductType(item.productType)) &&
                          !selectedElsewhere.has(String(product._id))
                      );
                      const selectedDocumentNames = new Set(
                        form.logisticsProducts
                          .filter(
                            (row, itemIndex) =>
                              itemIndex !== index && isDocumentProductType(row.productType)
                          )
                          .map((row) => String(row.productName || '').trim())
                          .filter(Boolean)
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
                                  uomId: '',
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
                            {isDocument ? (
                              <AdaptiveSelect
                                required={logisticsContextReady}
                                value={item.productName || ''}
                                disabled={!item.productType || productsLocked}
                                onChange={(event) =>
                                  selectDocumentModel(index, event.target.value)
                                }
                              >
                                <option value="">Select document type</option>
                                {DOCUMENT_MODEL_OPTIONS.map((name) => (
                                  <option
                                    key={name}
                                    value={name}
                                    disabled={
                                      selectedDocumentNames.has(name) &&
                                      item.productName !== name
                                    }
                                  >
                                    {name}
                                  </option>
                                ))}
                              </AdaptiveSelect>
                            ) : (
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
                            )}
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
                          <div className="arq-product-cell arq-product-uom-cell">
                            <label htmlFor={`arq-product-uom-${index}`}>UOM *</label>
                            <AdaptiveSelect
                              id={`arq-product-uom-${index}`}
                              required={logisticsContextReady}
                              value={item.uomId || ''}
                              disabled={
                                productsLocked ||
                                (isDocument ? !item.productName : !item.productId)
                              }
                              onChange={(event) =>
                                updateLogisticsProduct(index, { uomId: event.target.value })
                              }
                            >
                              <option value="">
                                {isDocument
                                  ? item.productName
                                    ? 'Select UOM'
                                    : 'Select document first'
                                  : item.productId
                                    ? 'Select UOM'
                                    : 'Select product first'}
                              </option>
                              {logisticsUoms.map((uom) => (
                                <option key={uom._id} value={uom._id}>
                                  {uom.name}
                                  {uom.code ? ` (${uom.code})` : ''}
                                </option>
                              ))}
                            </AdaptiveSelect>
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
                          : 'Complete category, model/variant/name, qty, and UOM first'
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
                {form.logisticsProductsConfirmed ? (
                  <div className="arq-asset-reason-row arq-span arq-logistics-client-row">
                    <div className="field">
                      <label htmlFor="logistics-client-name">Client name *</label>
                      <AdaptiveSelect
                        id="logistics-client-name"
                        required
                        threshold={1}
                        placeholder="Search client…"
                        value={form.clientId}
                        onChange={(e) => pickLogisticsClient(e.target.value)}
                      >
                        <option value="">
                          {clients.length ? 'Select client' : 'No clients in Client Master'}
                        </option>
                        {clients.map((client) => (
                          <option key={client._id} value={client._id}>
                            {[client.name, client.code].filter(Boolean).join(' · ') ||
                              String(client._id)}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>
                    <div className="field">
                      <label htmlFor="logistics-division">Division / Therapy *</label>
                      <AdaptiveSelect
                        id="logistics-division"
                        required
                        value={form.divisionTherapy}
                        disabled={!form.clientId || logisticsProgramsLoading}
                        onChange={(e) => pickLogisticsDivision(e.target.value)}
                      >
                        <option value="">
                          {!form.clientId
                            ? 'Select client first'
                            : logisticsProgramsLoading
                              ? 'Loading…'
                              : logisticsDivisionOptions.length
                                ? 'Select division / therapy'
                                : 'No divisions for this client'}
                        </option>
                        {logisticsDivisionOptions.map((division) => (
                          <option key={division} value={division}>
                            {division}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>
                    <div className="field">
                      <label htmlFor="logistics-method">Method *</label>
                      <AdaptiveSelect
                        id="logistics-method"
                        required
                        value={form.hiringMethod}
                        disabled={
                          !form.clientId ||
                          !form.divisionTherapy ||
                          logisticsProgramsLoading ||
                          !logisticsMethodOptions.length
                        }
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, hiringMethod: e.target.value }))
                        }
                      >
                        <option value="">
                          {!form.clientId
                            ? 'Select client first'
                            : !form.divisionTherapy
                              ? 'Select division first'
                              : logisticsProgramsLoading
                                ? 'Loading…'
                                : logisticsMethodOptions.length
                                  ? 'Select method'
                                  : 'No methods for this division'}
                        </option>
                        {logisticsMethodOptions.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>
                    <div className="field">
                      <label htmlFor="logistics-remarks">Remarks</label>
                      <input
                        id="logistics-remarks"
                        type="text"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="Add a short note"
                      />
                    </div>
                  </div>
                ) : null}
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
                <div className="arq-finance-meta-row arq-span">
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
                  <div className="field">
                    <label htmlFor="reimbursement-remarks">Remarks</label>
                    <input
                      id="reimbursement-remarks"
                      type="text"
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="Optional notes about this expense"
                    />
                  </div>
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
                  <p className="muted" style={{ margin: 0 }}>
                    On approval the record is created in Master One.
                  </p>
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
                    ) : (
                      <input
                        type="text"
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
                        placeholder={
                          field.type === 'textarea'
                            ? `Enter ${String(field.label || field.name).toLowerCase()}`
                            : undefined
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
                <div className="field">
                  <label>Note (optional)</label>
                  <input
                    type="text"
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
                {!['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD', 'LOGISTICS'].includes(
                  form.requestType
                ) ? (
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
            ) : !['TRAINING', 'REIMBURSEMENT', 'HIRING', 'MASTER_ADD', 'LOGISTICS'].includes(
                form.requestType
              ) ? (
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
              </div>
              <div className="cd-drawer-footer">
                <Button type="button" variant="secondary" size="compact" disabled={busy} onClick={closeCreate}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="compact" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit request'}
                </Button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      <MasterFilterShell
        className="arq-filter-shell"
        actions={
          <>
            <Button type="button" variant="secondary" size="compact" onClick={clearListFilters}>
              Clear
            </Button>
            <Button type="button" variant="secondary" size="compact" onClick={load}>
              Refresh
            </Button>
          </>
        }
      >
        <MasterSearchField
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search request #, remarks, AWB…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setPage(1);
              load();
            }
          }}
        />
        <AdaptiveSelect
          className="filter-select"
          aria-label="Request type"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {REQUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </AdaptiveSelect>
        <AdaptiveSelect
          className="filter-select"
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          {REQUEST_STATUS_FILTERS.map((s) => (
            <option key={s.value || 'all'} value={s.value}>
              {s.label}
            </option>
          ))}
        </AdaptiveSelect>
        <DateInput
          className="arq-filter-date"
          hideLabel
          aria-label="Created from"
          placeholder="From date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={setCreatedFrom}
        />
        <DateInput
          className="arq-filter-date"
          hideLabel
          aria-label="Created to"
          placeholder="To date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={setCreatedTo}
        />
      </MasterFilterShell>

      <section className="inv-catalog card card--flush table-wrap arq-table-wrap">
        <table className="inv-table arq-table">
          <colgroup>
            <col className="arq-col-number" />
            <col className="arq-col-type" />
            <col className="arq-col-status" />
            <col className="arq-col-requestor" />
            <col className="arq-col-updated" />
            <col className="arq-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Request Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Requestor</th>
              <th>Last Update</th>
              <th className="arq-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const isMine = isRequestOwner(user, r);
              const mayApprove = userCanApproveRow(r);
              const mayProcess = userCanProcessRow(r);
              const mayCancel = userCanCancelRow(r);
              const mayMutateAttachments = userCanMutateAttachments(r);
              const mayAssignHiring = mayProcess;
              const mayViewInfo = canViewRequest(user, can, r);
              const hiringNeedsReply = hasOpenClarification(r);
              const isActive = r.status === 'REQUESTED' || r.status === 'APPROVED';
              const mayRefuseApprove = mayApprove && r.status === 'REQUESTED';
              const mayRefuseCancel = isActive && mayCancel;
              const mayRefuse = mayRefuseApprove || mayRefuseCancel;
              const refuseMode = mayRefuseApprove ? 'reject' : 'cancel';
              const isServiceRequest =
                r.requestType === 'REPAIR' || r.requestType === 'MAINTENANCE';
              const overdue =
                r.status === 'REQUESTED' && isApprovalOverdue(r.createdAt || r.requestedAt);
              const displayStatus = requestDisplayStatus(r);
              return (
                <tr key={r._id}>
                  <td className="mono-sm">{r.requestNumber}</td>
                  <td className="arq-type">{displayType(r.requestType)}</td>
                  <td>
                    <span
                      className={`badge tone-${
                        overdue && displayStatus.label === 'Requested'
                          ? 'danger'
                          : displayStatus.tone
                      }`}
                    >
                      {displayStatus.label}
                    </span>
                    {overdue && displayStatus.label === 'Requested' ? (
                      <span className="badge tone-danger" style={{ marginLeft: 6 }}>
                        Overdue
                      </span>
                    ) : null}
                  </td>
                  <td className="arq-requestor">
                    {r.requestorId?.fullName || r.requestorId?.email || '-'}
                  </td>
                  <td className="arq-updated mono-sm">
                    {formatDateTime(requestLastUpdateAt(r))}
                  </td>
                  <td className="arq-actions-cell">
                    <div className="arq-actions" role="group" aria-label="Request actions">
                      {r.requestType === 'HIRING' ? (
                        <>
                          {r.status === 'REQUESTED' && isMine && !authorityExempt && !mayAssignHiring ? (
                            <span className="muted mono-sm">Awaiting assignment</span>
                          ) : null}
                          {r.status === 'REQUESTED' && !isMine && !mayAssignHiring ? (
                            <span className="muted mono-sm">Awaiting {APPROVAL_AUTHORITY_LABEL}</span>
                          ) : null}
                          <div className="arq-actions-primary">
                            {mayAssignHiring && ['REQUESTED', 'APPROVED'].includes(r.status) ? (
                              <button
                                type="button"
                                className="arq-icon-btn arq-icon-btn--approve"
                                title="Assign"
                                aria-label="Assign"
                                onClick={() => openFulfill(r)}
                              >
                                <UserCheck size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {mayRefuse ? (
                              <button
                                type="button"
                                className="arq-icon-btn arq-icon-btn--reject"
                                title="Refuse"
                                aria-label="Refuse"
                                onClick={() => openReject(r, refuseMode)}
                              >
                                <Ban size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {mayViewInfo ? (
                              <button
                                type="button"
                                className={`arq-icon-btn${
                                  hiringNeedsReply && isMine ? ' arq-icon-btn--attention' : ''
                                }`}
                                title={
                                  r.status === 'REJECTED' || r.status === 'CANCELLED'
                                    ? 'View request details'
                                    : hiringNeedsReply
                                      ? 'Request details — clarification waiting'
                                      : 'Request details'
                                }
                                aria-label="Request details"
                                onClick={() => openHiringLog(r)}
                              >
                                <Info size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {r.jdAttachment ? (
                              <button
                                type="button"
                                className="arq-icon-btn"
                                title="View JD"
                                aria-label="View JD"
                                onClick={() => openJd(r)}
                              >
                                <FileText size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {!r.jdAttachment && isActive && mayMutateAttachments ? (
                              <button
                                type="button"
                                className="arq-icon-btn"
                                title="Upload JD"
                                aria-label="Upload JD"
                                onClick={() => {
                                  setJdFile(null);
                                  if (jdFileRef.current) jdFileRef.current.value = '';
                                  setJdUploadPrompt({
                                    id: r._id,
                                    requestNumber: r.requestNumber || r._id,
                                  });
                                }}
                              >
                                <Upload size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {canDeleteRequests ? (
                              <button
                                type="button"
                                className="arq-icon-btn arq-icon-btn--danger"
                                title={`Delete ${r.requestNumber || r._id}`}
                                aria-label={`Delete ${r.requestNumber || r._id}`}
                                onClick={() => requestDeleteRequest(r)}
                              >
                                <Trash2 size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          {r.status === 'REQUESTED' && !isMine && !mayApprove ? (
                            <span className="muted mono-sm">
                              Awaiting {approvalRuleLabel(r.requestType)}
                            </span>
                          ) : null}
                          {r.status === 'REQUESTED' && isMine && !authorityExempt && !mayApprove ? (
                            <span className="muted mono-sm">Awaiting approval</span>
                          ) : null}
                          <div className="arq-actions-primary">
                            {mayApprove &&
                            r.status === 'REQUESTED' &&
                            r.requestType !== 'MASTER_ADD' ? (
                              <button
                                type="button"
                                className="arq-icon-btn arq-icon-btn--approve"
                                title="Approve"
                                aria-label="Approve"
                                onClick={() => act(r._id, 'approve')}
                              >
                                <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {canShowProcessAction(r, { mayApprove, mayProcess })
                              ? (() => {
                                  const action = processActionForType(r.requestType);
                                  const Icon = processActionIcon(r.requestType);
                                  return (
                                    <button
                                      type="button"
                                      className="arq-icon-btn arq-icon-btn--approve"
                                      title={action.label}
                                      aria-label={action.label}
                                      onClick={() => openProcess(r)}
                                    >
                                      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                                    </button>
                                  );
                                })()
                              : null}
                            {mayRefuse ? (
                              <button
                                type="button"
                                className="arq-icon-btn arq-icon-btn--reject"
                                title="Refuse"
                                aria-label="Refuse"
                                onClick={() => openReject(r, refuseMode)}
                              >
                                <Ban size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {mayViewInfo ? (
                              <button
                                type="button"
                                className={`arq-icon-btn${
                                  hiringNeedsReply && isMine ? ' arq-icon-btn--attention' : ''
                                }`}
                                title={
                                  hiringNeedsReply
                                    ? 'Request details — clarification waiting'
                                    : 'Request details'
                                }
                                aria-label="Request details"
                                onClick={() => openHiringLog(r)}
                              >
                                <Info size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {r.requestType === 'REIMBURSEMENT' && r.billAttachment ? (
                              <button
                                type="button"
                                className="arq-icon-btn"
                                title="View bill"
                                aria-label="View bill"
                                onClick={() => openBill(r)}
                              >
                                <FileText size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {(r.requestType === 'OTHER' || r.requestType === 'MASTER_ADD') &&
                            r.requestAttachment ? (
                              <button
                                type="button"
                                className="arq-icon-btn"
                                title="View attachment"
                                aria-label="View attachment"
                                onClick={() => openRequestAttachment(r)}
                              >
                                <FileText size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {isServiceRequest && isActive && mayMutateAttachments ? (
                              <button
                                type="button"
                                className="arq-icon-btn"
                                title="Generate image link"
                                aria-label="Generate image link"
                                disabled={linkBusyId === r._id}
                                onClick={() => generateImageLink(r)}
                              >
                                <Link2 size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {isServiceRequest && generatedLinks[r._id] ? (
                              <button
                                type="button"
                                className="arq-icon-btn"
                                title="Copy link"
                                aria-label="Copy link"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(generatedLinks[r._id]);
                                    setMsg('Product image link copied to clipboard.');
                                  } catch {
                                    setError(
                                      'Could not copy the link. Select and copy it manually.'
                                    );
                                  }
                                }}
                              >
                                <Copy size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                            {canDeleteRequests ? (
                              <button
                                type="button"
                                className="arq-icon-btn arq-icon-btn--danger"
                                title={`Delete ${r.requestNumber || r._id}`}
                                aria-label={`Delete ${r.requestNumber || r._id}`}
                                onClick={() => requestDeleteRequest(r)}
                              >
                                <Trash2 size={16} strokeWidth={2.25} aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length && (
              <tr>
                <td colSpan={6}>
                  <div className="inv-empty arq-empty">
                    {listLoading ? (
                      <p className="muted" style={{ margin: 0 }}>
                        Loading requests…
                      </p>
                    ) : (
                      <>
                        <strong>
                          {q || typeFilter || statusFilter || appliedDateFrom || appliedDateTo
                            ? 'No matching requests'
                            : 'No requests yet'}
                        </strong>
                        <p className="muted">
                          {q || typeFilter || statusFilter || appliedDateFrom || appliedDateTo
                            ? 'Try clearing filters or adjusting the date range.'
                            : 'Raise a request to start tracking work in Request One.'}
                        </p>
                        {q || typeFilter || statusFilter || appliedDateFrom || appliedDateTo ? (
                          <Button type="button" variant="secondary" size="compact" onClick={clearListFilters}>
                            Clear filters
                          </Button>
                        ) : canRequest ? (
                          <Button type="button" variant="primary" onClick={openCreate}>
                            + New request
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
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
      </section>
      <ConfirmDialog
        open={Boolean(cancelConfirmTarget)}
        title="Cancel Asset Request"
        message={
          cancelConfirmTarget
            ? `Cancel request ${cancelConfirmTarget.requestNumber || cancelConfirmTarget._id}?${
                cancelRequiresRemark(user, cancelConfirmTarget)
                  ? ' A remark is required.'
                  : ''
              }`
            : ''
        }
        confirmLabel={cancelBusy ? 'Cancelling…' : 'Cancel request'}
        confirmVariant="danger"
        loading={cancelBusy}
        onConfirm={handleConfirmCancelRequest}
        onCancel={() => {
          if (!cancelBusy) {
            setCancelConfirmTarget(null);
            setCancelReason('');
          }
        }}
      >
        {cancelConfirmTarget && cancelRequiresRemark(user, cancelConfirmTarget) ? (
          <div className="field" style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="arq-cancel-remark">Remark *</label>
            <textarea
              id="arq-cancel-remark"
              required
              rows={3}
              value={cancelReason}
              disabled={cancelBusy}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this request being cancelled?"
            />
          </div>
        ) : null}
      </ConfirmDialog>
      <ModalShell
        open={Boolean(hiringLogTarget)}
        onClose={closeHiringLog}
        title={
          hiringLogTarget
            ? `${hiringLogTarget.requestNumber || hiringLogTarget._id}`
            : 'Request'
        }
        titleId="arq-hiring-log-title"
        panelClassName="modal-card modal-card--sm arq-hiring-panel"
        closeOnOverlayClick={!hiringLogBusy && !hiringUpdateBusy}
      >
        {hiringLogTarget ? (
          <>
            {(() => {
              const status = hiringLogData?.status || hiringLogTarget.status;
              const refusalRemark =
                status === 'REJECTED'
                  ? String(
                      hiringLogData?.rejectionReason || hiringLogTarget.rejectionReason || ''
                    ).trim()
                  : status === 'CANCELLED'
                    ? String(
                        hiringLogData?.cancellationReason ||
                          hiringLogTarget.cancellationReason ||
                          ''
                      ).trim()
                    : '';
              const refusalWhen =
                status === 'REJECTED'
                  ? hiringLogData?.rejectedAt || hiringLogTarget.rejectedAt
                  : status === 'CANCELLED'
                    ? hiringLogData?.cancelledAt || hiringLogTarget.cancelledAt
                    : null;
              const mayReplyHiring =
                isRequestOwner(user, hiringLogTarget) &&
                canCreatorEditHiringDetails({
                  ...hiringLogTarget,
                  ...(hiringLogData || {}),
                });
              const mayPostHiring =
                !mayReplyHiring &&
                canProcessRequest(user, can, hiringLogTarget) &&
                ['REQUESTED', 'APPROVED'].includes(status);
              const progressOptions = hiringProgressOptionsForType(
                hiringLogTarget.requestType
              );
              const isClarification = hiringUpdateForm.kind === 'CLARIFICATION';
              const onActions = requestInfoTab === 'actions';
              const detailRows = requestDetailFields(hiringLogTarget);
              const actionLog = buildRequestActionLog(hiringLogTarget, hiringLogData);
              const infoStatus = requestDisplayStatus({
                ...hiringLogTarget,
                status,
                hiringProgress:
                  hiringLogData?.hiringProgress || hiringLogTarget.hiringProgress,
              });
              return (
                <>
                  <div className="arq-hiring-panel__header">
                    <span className={`badge tone-${infoStatus.tone}`}>{infoStatus.label}</span>
                    <span className="muted mono-sm arq-hiring-panel__type">
                      {displayType(hiringLogTarget.requestType)}
                    </span>
                  </div>

                  <div
                    className="arq-hiring-mode arq-request-info-tabs"
                    role="tablist"
                    aria-label="Request info sections"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={!onActions}
                      className={`arq-hiring-mode__btn${!onActions ? ' is-active' : ''}`}
                      onClick={() => setRequestInfoTab('details')}
                    >
                      Request Details
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={onActions}
                      className={`arq-hiring-mode__btn${onActions ? ' is-active' : ''}`}
                      onClick={() => setRequestInfoTab('actions')}
                    >
                      Request Actions
                    </button>
                  </div>

                  <div className="arq-hiring-panel__body">
                    {!onActions ? (
                      detailRows.length ? (
                        <dl className="arq-request-details">
                          {detailRows.map((row) => (
                            <div className="arq-request-details__row" key={row.label}>
                              <dt>{row.label}</dt>
                              <dd>{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <div className="arq-request-details arq-request-details--empty muted">
                          No detail fields recorded.
                        </div>
                      )
                    ) : (
                      <>
                        {refusalRemark ? (
                          <div className="arq-hiring-refusal">
                            <div className="arq-hiring-log__meta">
                              <strong>Refuse remark</strong>
                              {refusalWhen ? (
                                <span className="muted">
                                  {formatDateTime(refusalWhen)}
                                </span>
                              ) : null}
                            </div>
                            <p>{refusalRemark}</p>
                          </div>
                        ) : status === 'REJECTED' || status === 'CANCELLED' ? (
                          <div className="arq-hiring-refusal arq-hiring-refusal--empty muted">
                            No refuse remark recorded.
                          </div>
                        ) : null}

                        <div className="arq-request-actions-block">
                          <div className="arq-request-actions-block__label">Work log</div>
                          {hiringLogLoading ? (
                            <p className="muted">Loading updates…</p>
                          ) : (
                            <ul className="arq-hiring-log">
                              {actionLog.length ? (
                                actionLog.map((entry) => {
                                  const kindKey = String(entry.kind || '').toUpperCase();
                                  const kindLabel = hiringUpdateKindLabel(entry.kind);
                                  const progressLabel = entry.progress
                                    ? hiringProgressLabel(entry.progress)
                                    : '';
                                  const showProgress =
                                    progressLabel &&
                                    progressLabel.toLowerCase() !== kindLabel.toLowerCase();
                                  const awaitingReply =
                                    kindKey === 'CLARIFICATION' &&
                                    entry.requiresReply &&
                                    !entry.resolvedAt;
                                  const toneClass =
                                    kindKey === 'CLARIFICATION'
                                      ? 'arq-hiring-log__item--ask'
                                      : kindKey === 'REPLY'
                                        ? 'arq-hiring-log__item--reply'
                                        : kindKey === 'STATUS'
                                          ? 'arq-hiring-log__item--status'
                                          : '';
                                  return (
                                    <li
                                      key={entry.id || `${entry.at}-${entry.kind}-${entry.message}`}
                                      className={`arq-hiring-log__item ${toneClass}`.trim()}
                                    >
                                      <div className="arq-hiring-log__top">
                                        <span className="arq-hiring-log__kind">{kindLabel}</span>
                                        {showProgress ? (
                                          <span className="arq-hiring-log__progress">
                                            {progressLabel}
                                          </span>
                                        ) : null}
                                        {awaitingReply ? (
                                          <span className="arq-hiring-log__pending">
                                            Needs reply
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="arq-hiring-log__message">{entry.message}</p>
                                      <div className="arq-hiring-log__meta">
                                        <span>{entry.actorName || 'User'}</span>
                                        {entry.at ? (
                                          <span>{formatDateTime(entry.at)}</span>
                                        ) : null}
                                      </div>
                                    </li>
                                  );
                                })
                              ) : (
                                <li className="arq-hiring-log__empty muted">No updates yet.</li>
                              )}
                            </ul>
                          )}
                        </div>

                        {mayPostHiring ? (
                          <form
                            id="arq-hiring-update-form"
                            className="arq-hiring-form"
                            onSubmit={submitHiringUpdate}
                          >
                            <div
                              className="arq-hiring-mode"
                              role="tablist"
                              aria-label="Hiring update action"
                            >
                              {HIRING_UPDATE_KIND_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="tab"
                                  aria-selected={hiringUpdateForm.kind === opt.value}
                                  className={`arq-hiring-mode__btn${
                                    hiringUpdateForm.kind === opt.value ? ' is-active' : ''
                                  }`}
                                  disabled={hiringUpdateBusy || hiringLogBusy}
                                  onClick={() =>
                                    setHiringUpdateForm((prev) => ({
                                      ...prev,
                                      kind: opt.value,
                                      message: opt.value === 'STATUS' ? '' : prev.message,
                                    }))
                                  }
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            {!isClarification ? (
                              <div className="field">
                                <label htmlFor="hiring-update-progress">Progress</label>
                                <select
                                  id="hiring-update-progress"
                                  className="field-input"
                                  value={hiringUpdateForm.progress}
                                  disabled={hiringUpdateBusy || hiringLogBusy}
                                  onChange={(e) =>
                                    setHiringUpdateForm((prev) => ({
                                      ...prev,
                                      progress: e.target.value,
                                    }))
                                  }
                                >
                                  {progressOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="field">
                                <label htmlFor="hiring-update-message">Clarification</label>
                                <input
                                  id="hiring-update-message"
                                  className="field-input"
                                  required
                                  maxLength={240}
                                  value={hiringUpdateForm.message}
                                  disabled={hiringUpdateBusy || hiringLogBusy}
                                  onChange={(e) =>
                                    setHiringUpdateForm((prev) => ({
                                      ...prev,
                                      message: e.target.value,
                                    }))
                                  }
                                  placeholder="Ask a short question…"
                                />
                              </div>
                            )}
                          </form>
                        ) : null}

                        {mayReplyHiring ? (
                          <div className="arq-hiring-reply">
                            <div className="field">
                              <label htmlFor="hiring-log-reply">Your reply</label>
                              <input
                                id="hiring-log-reply"
                                className="field-input"
                                value={hiringReply}
                                disabled={hiringLogBusy}
                                maxLength={240}
                                onChange={(e) => setHiringReply(e.target.value)}
                                placeholder="Answer in a short reply…"
                              />
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="arq-hiring-panel__footer">
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={hiringLogBusy || hiringUpdateBusy}
                      onClick={closeHiringLog}
                    >
                      Close
                    </button>
                    {onActions && mayReplyHiring ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={hiringLogBusy}
                        onClick={() => submitHiringReply({ withDetails: false })}
                      >
                        {hiringLogBusy ? 'Sending…' : 'Send reply'}
                      </button>
                    ) : null}
                    {onActions && mayPostHiring ? (
                      <button
                        type="submit"
                        form="arq-hiring-update-form"
                        className="btn"
                        disabled={hiringUpdateBusy || hiringLogBusy}
                      >
                        {hiringUpdateBusy
                          ? 'Saving…'
                          : isClarification
                            ? 'Ask clarification'
                            : 'Update status'}
                      </button>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </>
        ) : null}
      </ModalShell>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Refuse request?"
        message={
          rejectTarget
            ? `Refuse request ${rejectTarget.requestNumber}? A remark is required.`
            : ''
        }
        confirmLabel={rejectBusy ? 'Refusing…' : 'Refuse'}
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={rejectBusy}
        onConfirm={submitReject}
        onCancel={closeReject}
      >
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <label htmlFor="arq-reject-remark">Remark *</label>
          <textarea
            id="arq-reject-remark"
            required
            rows={3}
            value={rejectReason}
            disabled={rejectBusy}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this request being refused?"
          />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(deleteConfirmTarget)}
        title="Delete request?"
        message={
          deleteConfirmTarget
            ? `Remove “${deleteConfirmTarget.requestNumber || deleteConfirmTarget._id}” from Request One? This cannot be undone from the list.`
            : ''
        }
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete request'}
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={deleteBusy}
        onConfirm={handleConfirmDeleteRequest}
        onCancel={() => {
          if (!deleteBusy) setDeleteConfirmTarget(null);
        }}
      />
</PageShell>
  );
}
