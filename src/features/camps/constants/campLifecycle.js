import {
  computeDurationHours,
  getCampEndDateTime,
  getCampStartDateTime,
} from '../utils/campSchedule.js';
import { DEFAULT_DOCTOR_SPECIALTY } from './doctorSpecialty.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';
import {
  normalizeContactPersons,
  syncPrimaryContactFields,
  DEFAULT_CONTACT_PERSON_LEVEL,
  CONTACT_PERSON_LEVEL_OPTIONS,
} from '../utils/campContactPersons.js';
import { getConsumablesCompletionBlockers } from '../utils/campConsumables.js';
import {
  CAMP_FINANCE_EXPENSE_CATEGORY,
  CAMP_FINANCE_EXPENSE_SUB_CATEGORY,
} from '../utils/campFinanceExpense.js';
import { resolveCampClientId } from '../utils/clientMasterCascade.js';
import { computeCampRevenueFromPricing } from '../utils/campClientMasterPricing.js';

export { CONTACT_PERSON_LEVEL_OPTIONS };

export const CAMP_LIFECYCLE_STAGES = [
  { id: 'request', label: 'Request Stage', short: 'Request' },
  { id: 'assignment', label: 'Resource Assignment', short: 'Assignment' },
  { id: 'execution', label: 'Camp Execution', short: 'Execution' },
  { id: 'financial', label: 'Finance & Settlement', short: 'Financial' },
];

const LIFECYCLE_STAGE_ALIASES = {
  request: 'request',
  assignment: 'assignment',
  execution: 'execution',
  financial: 'financial',
  'camp execution': 'execution',
  'finance & settlement': 'financial',
  'finance and settlement': 'financial',
};

export function normalizeLifecycleStage(stage, fallback = 'request') {
  const raw = String(stage || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (LIFECYCLE_STAGE_ALIASES[raw]) return LIFECYCLE_STAGE_ALIASES[raw];
  const byId = CAMP_LIFECYCLE_STAGES.find((item) => item.id === raw);
  if (byId) return byId.id;
  const byLabel = CAMP_LIFECYCLE_STAGES.find((item) => item.label.toLowerCase() === raw);
  if (byLabel) return byLabel.id;
  const byShort = CAMP_LIFECYCLE_STAGES.find((item) => item.short.toLowerCase() === raw);
  if (byShort) return byShort.id;
  return fallback;
}

export const CAMP_STATUS_LABELS = {
  pending_review: 'Pending review',
  approved: 'Approved',
  executed: 'Executed',
  rejected: 'Refused',
  cancelled: 'Cancelled',
};

export function campStatusLabel(status) {
  const key = String(status || '').trim();
  return CAMP_STATUS_LABELS[key] || key.replaceAll('_', ' ');
}

export function lifecycleStageIndex(stage) {
  return CAMP_LIFECYCLE_STAGES.findIndex((s) => s.id === normalizeLifecycleStage(stage, ''));
}

export function hasReachedLifecycleStage(reachedStage, targetStage) {
  const reached = lifecycleStageIndex(normalizeLifecycleStage(reachedStage, 'request'));
  const target = lifecycleStageIndex(normalizeLifecycleStage(targetStage, ''));
  if (reached < 0 || target < 0) return false;
  return target <= reached;
}

/** Financial opens only after the camp has entered the Financial lifecycle stage. */
export function canVisitLifecycleStage(reachedStage, targetStage) {
  const target = normalizeLifecycleStage(targetStage, '');
  if (!target) return false;
  if (target === 'financial') {
    return normalizeLifecycleStage(reachedStage, 'request') === 'financial';
  }
  return hasReachedLifecycleStage(reachedStage, target);
}

export function normalizeExecutionDocType(docType) {
  const raw = String(docType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'doctor_form' || raw === 'df' || raw.includes('doctor')) return 'doctor_form';
  if (raw === 'patient_form' || raw === 'pf' || raw.includes('patient')) return 'patient_form';
  return raw;
}

function hasExecutionDocType(docs, targetType) {
  return (docs || []).some((doc) => normalizeExecutionDocType(doc?.docType) === targetType);
}

export function getExecutionFinanceBlockers(camp = {}, mappedConsumables = []) {
  if (isExecutionCancellationForFinance(camp)) {
    return [];
  }
  const blockers = [];
  if (isExecutionClosedOut(camp.executionStatus)) {
    blockers.push('Execution is cancelled or refused');
    return blockers;
  }
  const execStatus = normalizeExecutionStatus(camp.executionStatus);
  if (
    execStatus !== EXECUTION_STATUS.CAMP_COMPLETED
    && execStatus !== EXECUTION_STATUS.MARKED_EXECUTED
  ) {
    blockers.push('Complete Chargeable Status, In Time, and Attire before Mark Complete');
  }
  if (!String(camp.chargeableStatus || '').trim()) {
    blockers.push('Select chargeable status');
  }
  if (!String(camp.inTime || '').trim()) {
    blockers.push('Enter in time on the execution form');
  }
  if (!String(camp.attire || '').trim()) {
    blockers.push('Select attire on the execution form');
  }
  if (!String(camp.outTime || '').trim()) {
    blockers.push('Enter out time on the execution form');
  }
  if (camp.kmRoundTrip === '' || camp.kmRoundTrip == null || Number.isNaN(Number(camp.kmRoundTrip))) {
    blockers.push('Enter Travelled Kms (Round Trip)');
  }
  const patients = camp.actualPatients ?? camp.patientsCount;
  if (patients === '' || patients == null || Number.isNaN(Number(patients))) {
    blockers.push('Enter Patients Screened');
  }
  if (camp.rxCount === '' || camp.rxCount == null || Number.isNaN(Number(camp.rxCount))) {
    blockers.push('Enter Product Count');
  }
  const docs = Array.isArray(camp.executionDocuments) ? camp.executionDocuments : [];
  if (!hasExecutionDocType(docs, 'doctor_form')) {
    blockers.push('Upload at least one DF (doctor form) document');
  }
  if (!hasExecutionDocType(docs, 'patient_form')) {
    blockers.push('Upload at least one PF (patient form) document');
  }
  blockers.push(...getExecutionConsumablesBlockers(camp, mappedConsumables));
  return blockers;
}

export function getExecutionConsumablesBlockers(camp = {}, mappedConsumables = []) {
  if (isExecutionCancellationForFinance(camp)) return [];
  if (!Array.isArray(mappedConsumables) || !mappedConsumables.length) return [];
  const normalized = normalizeExecutionStatus(camp.executionStatus);
  const effective = normalized === EXECUTION_STATUS.CAMP_COMPLETED
    ? EXECUTION_STATUS.CAMP_COMPLETED
    : isExecutionClosedOut(normalized)
      ? normalized
      : resolveScheduledExecutionStatus(camp);
  if (effective === EXECUTION_STATUS.CAMP_SCHEDULED) return [];
  return getConsumablesCompletionBlockers(mappedConsumables, camp.consumablesUsed);
}

export function isExecutionReadyForFinance(camp = {}, mappedConsumables = []) {
  return getExecutionFinanceBlockers(camp, mappedConsumables).length === 0;
}

export function maxLifecycleStage(a, b) {
  return lifecycleStageIndex(a) >= lifecycleStageIndex(b) ? a : b;
}

export const CAMP_SOURCE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'excel', label: 'Import' },
  { value: 'paste', label: 'Manual Paste' },
  { value: 'parser', label: 'Request Parser' },
  { value: 'api', label: 'API' },
];

export const CAMP_SLOTS = ['Morning', 'Noon', 'Evening'];
export const ASSIGNMENT_DECISIONS = [
  { value: 'assign', label: 'Assign' },
  { value: 'refuse', label: 'Refuse' },
];
export const ASSIGNMENT_REFUSAL_REASONS = [
  'Refused',
  'Cancelled by Tylo',
  'Cancelled by Client',
];
export const ASSIGNMENT_STATUSES = ['Pending', 'Assigned', 'Reassigned', 'Unassigned'];

export const EXECUTION_STATUS = {
  CAMP_SCHEDULED: 'Camp Scheduled',
  CAMP_ONGOING: 'Camp Ongoing',
  CAMP_COMPLETED: 'Camp Completed',
  MARKED_EXECUTED: 'Marked Executed',
};

export const EXECUTION_STATUSES = [
  EXECUTION_STATUS.CAMP_SCHEDULED,
  EXECUTION_STATUS.CAMP_ONGOING,
  EXECUTION_STATUS.MARKED_EXECUTED,
  EXECUTION_STATUS.CAMP_COMPLETED,
];

export const LEGACY_EXECUTION_CLOSED_STATUSES = ['Cancelled', 'Refused'];

/** Closure Type values that also serve as Execution Status. */
export const EXECUTION_CANCELLATION_STATUSES = [
  'Cancelled by Tylo',
  'Cancelled by Client',
];

const LEGACY_EXECUTION_STATUS_ALIASES = {
  Pending: EXECUTION_STATUS.CAMP_SCHEDULED,
  'Yet to Start': EXECUTION_STATUS.CAMP_SCHEDULED,
  'In Progress': EXECUTION_STATUS.CAMP_ONGOING,
  Ongoing: EXECUTION_STATUS.CAMP_ONGOING,
  Executed: EXECUTION_STATUS.MARKED_EXECUTED,
  Completed: EXECUTION_STATUS.CAMP_COMPLETED,
  'Cancelled by TCPL': 'Cancelled by Tylo',
};

export function normalizeExecutionStatus(executionStatus) {
  const value = String(executionStatus || '').trim();
  if (value === 'Rejected') return 'Refused';
  if (LEGACY_EXECUTION_STATUS_ALIASES[value]) return LEGACY_EXECUTION_STATUS_ALIASES[value];
  return value;
}

export function isExecutionClosedOut(executionStatus) {
  const normalized = normalizeExecutionStatus(executionStatus);
  return LEGACY_EXECUTION_CLOSED_STATUSES.includes(normalized)
    || EXECUTION_CANCELLATION_STATUSES.includes(normalized);
}

export function isExecutionCancellationStatus(executionStatus) {
  return EXECUTION_CANCELLATION_STATUSES.includes(normalizeExecutionStatus(executionStatus));
}

export function isExecutionCancellationForFinance(camp = {}) {
  if (isExecutionCancellationStatus(camp.executionStatus)) return true;
  const reason = normalizeExecutionStatus(camp.assignmentRefusalReason || '');
  if (EXECUTION_CANCELLATION_STATUSES.includes(reason)) return true;
  if (String(camp.status || '').trim() === 'cancelled') {
    if (camp.cancelledBy === 'brand') return true;
    if (camp.cancelledBy === 'khw') return true;
  }
  return false;
}

export function resolveCancelledClosureExecutionStatus(camp = {}) {
  if (isExecutionCancellationStatus(camp.executionStatus)) {
    return normalizeExecutionStatus(camp.executionStatus);
  }
  const reason = normalizeExecutionStatus(camp.assignmentRefusalReason || '');
  if (EXECUTION_CANCELLATION_STATUSES.includes(reason)) return reason;
  if (String(camp.status || '').trim() === 'cancelled') {
    if (camp.cancelledBy === 'brand') return 'Cancelled by Client';
    if (camp.cancelledBy === 'khw') return 'Cancelled by Tylo';
  }
  return '';
}

export function resolveScheduledExecutionStatus(camp = {}, now = new Date()) {
  const start = getCampStartDateTime(camp);
  const end = getCampEndDateTime(camp);
  if (!start || !end) return EXECUTION_STATUS.CAMP_SCHEDULED;

  const ts = now.getTime();
  if (ts < start.getTime()) return EXECUTION_STATUS.CAMP_SCHEDULED;
  if (ts <= end.getTime()) return EXECUTION_STATUS.CAMP_ONGOING;
  return EXECUTION_STATUS.MARKED_EXECUTED;
}

export function resolveEffectiveExecutionStatus(camp = {}, now = new Date()) {
  const closureStatus = resolveCancelledClosureExecutionStatus(camp);
  if (closureStatus) return closureStatus;
  const normalized = normalizeExecutionStatus(camp.executionStatus);
  if (normalized === EXECUTION_STATUS.CAMP_COMPLETED) return EXECUTION_STATUS.CAMP_COMPLETED;
  if (normalized === EXECUTION_STATUS.MARKED_EXECUTED) return EXECUTION_STATUS.MARKED_EXECUTED;
  if (isExecutionClosedOut(normalized)) return normalized;
  // Field-driven Planned → Executed (guide): do not rely on clock alone for Executed.
  if (
    String(camp.chargeableStatus || '').trim()
    && String(camp.inTime || '').trim()
    && String(camp.attire || '').trim()
  ) {
    return EXECUTION_STATUS.MARKED_EXECUTED;
  }
  return EXECUTION_STATUS.CAMP_SCHEDULED;
}

export function executionStatusLabel(status) {
  const normalized = normalizeExecutionStatus(status);
  const labels = {
    [EXECUTION_STATUS.CAMP_SCHEDULED]: 'Planned',
    [EXECUTION_STATUS.CAMP_ONGOING]: 'Planned',
    [EXECUTION_STATUS.MARKED_EXECUTED]: 'Executed',
    [EXECUTION_STATUS.CAMP_COMPLETED]: 'Executed',
    'Cancelled by Tylo': 'Cancelled by Tylo',
    'Cancelled by TCPL': 'Cancelled by Tylo',
    'Cancelled by Client': 'Cancelled by Client',
  };
  return labels[normalized] || normalized || '—';
}

export function syncExecutionStatusForSave(camp = {}, now = new Date()) {
  const normalized = normalizeExecutionStatus(camp.executionStatus);
  if (normalized === EXECUTION_STATUS.CAMP_COMPLETED) return EXECUTION_STATUS.CAMP_COMPLETED;
  if (isExecutionClosedOut(normalized)) return normalized;
  if (
    String(camp.chargeableStatus || '').trim()
    && String(camp.inTime || '').trim()
    && String(camp.attire || '').trim()
  ) {
    return EXECUTION_STATUS.MARKED_EXECUTED;
  }
  return EXECUTION_STATUS.CAMP_SCHEDULED;
}
export function executionStatusClass(status) {
  return `execution-${String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')}`;
}

export const CHARGEABLE_STATUSES = ['Chargeable', 'Non-Chargeable', 'Partial'];
export const QUALITY_RATINGS = ['Good', 'Average', 'Poor'];
export const ATTIRE_CHECK_OPTIONS = ['No Issues', 'Issues'];
export const HCW_CATEGORIES = ['Technician', 'Phlebotomist', 'Dietician', 'Other'];
export const EXECUTION_DOC_TYPES = [
  { value: 'doctor_form', label: 'Doctor Form (DF)' },
  { value: 'patient_form', label: 'Patient Form (PF)' },
  { value: 'gps_selfie', label: 'GPS Selfie (GS)' },
  { value: 'other', label: 'Other document (OT)' },
];

/** Selectable Camp One payment-check statuses (Payment Done is Finance One only). */
export const PAYMENT_SUBMIT_STATUSES = [
  { value: 'payment_not_checked', label: 'Pending Confirmation' },
  { value: 'payment_confirmed', label: 'Confirmed Payment' },
  { value: 'payment_hold', label: 'Hold' },
];

/** Internal Finance One codes — do not expose Not Paid / Under Review as Camp One statuses. */
export const FINANCE_PAYMENT_STATUSES = [
  { value: 'paid', label: 'Payment Done' },
];

export function paymentSubmitStatusLabel(value) {
  if (!value) return 'Pending Confirmation';
  return PAYMENT_SUBMIT_STATUSES.find((o) => o.value === value)?.label || value || '—';
}

export function financePaymentStatusLabel(value) {
  if (String(value || '').trim() === 'paid') return 'Payment Done';
  return '';
}

export function resolveInTimeSelfieUrl(campOrForm = {}) {
  if (campOrForm.inTimeSelfieUrl) return campOrForm.inTimeSelfieUrl;
  const docs = Array.isArray(campOrForm.executionDocuments) ? campOrForm.executionDocuments : [];
  const selfies = docs.filter((d) => d.docType === 'gps_selfie');
  if (!selfies.length) return '';
  const latest = selfies.sort((a, b) =>
    String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || ''))
  )[0];
  return latest?.url || '';
}

const DURATION_OPTIONS = [3, 4, 5, 6, 8];

export { DURATION_OPTIONS };

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Camp slot from camp start time:
 * 06:00–12:59 → Morning, 13:00–16:59 → Noon, 17:00–21:00 → Evening
 */
export function resolveCampSlot(startTime) {
  const mins = parseTimeToMinutes(startTime);
  if (mins == null) return '';
  if (mins >= 6 * 60 && mins < 13 * 60) return 'Morning';
  if (mins >= 13 * 60 && mins < 17 * 60) return 'Noon';
  if (mins >= 17 * 60 && mins <= 21 * 60) return 'Evening';
  return '';
}

/**
 * Minutes late (positive), early (negative), or on time (0) from camp start vs in time.
 */
export function computePunctualityLateness(campStartTime, inTime) {
  const startMins = parseTimeToMinutes(campStartTime);
  const inMins = parseTimeToMinutes(inTime);
  if (startMins == null || inMins == null) return null;

  let lateMinutes = inMins - startMins;
  if (lateMinutes < -12 * 60) lateMinutes += 24 * 60;
  if (lateMinutes > 12 * 60) lateMinutes -= 24 * 60;
  return lateMinutes;
}

export function formatLatenessHhMm(lateMinutes) {
  if (lateMinutes == null || Number.isNaN(lateMinutes)) return '';
  const abs = Math.abs(lateMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function punctualityLatenessText(campStartTime, inTime) {
  const lateMinutes = computePunctualityLateness(campStartTime, inTime);
  if (lateMinutes == null) return '';
  if (lateMinutes <= 0) return '00:00';
  return formatLatenessHhMm(lateMinutes);
}

/**
 * Punctuality from camp start vs in time:
 * on time / early through 5 min late → Good; 5–15 min late → Average; 15+ min late → Poor.
 */
export function resolvePunctuality(campStartTime, inTime) {
  const lateMinutes = computePunctualityLateness(campStartTime, inTime);
  if (lateMinutes == null) return '';

  if (lateMinutes <= 5) return 'Good';
  if (lateMinutes <= 15) return 'Average';
  return 'Poor';
}

export function computeLifecycleDerived(form = {}, { pricing = null } = {}) {
  const durationHours = Number(form.durationHours) || 0;
  const campSlot = resolveCampSlot(form.startTime);

  let totalHours = form.totalHours;
  if (form.inTime && form.outTime) {
    const start = parseTimeToMinutes(form.inTime);
    const end = parseTimeToMinutes(form.outTime);
    if (start != null && end != null) {
      let diff = end - start;
      if (diff <= 0) diff += 24 * 60;
      totalHours = Math.round((diff / 60) * 100) / 100;
    }
  }

  let extraHours = 0;
  if (totalHours != null && durationHours > 0) {
    extraHours = Math.max(0, Math.round((totalHours - durationHours) * 100) / 100);
  }

  const autoRevenue = pricing
    ? computeCampRevenueFromPricing({ ...form, totalHours, extraHours }, pricing)
    : null;

  // Editable persisted values win; Client Master formula is only a default/suggestion.
  const campRevenue = Number(form.campRevenue) || 0;
  const travelRevenue = Number(form.travelRevenue) || 0;
  const overtimeRevenue = Number(form.overtimeRevenue) || 0;
  const otherRevenue = Number(form.otherRevenue) || 0;
  const otherRevenuePatients = autoRevenue ? autoRevenue.otherRevenuePatients : 0;
  const otherRevenueDistance = autoRevenue ? autoRevenue.otherRevenueDistance : 0;
  const totalRevenue = Math.round((campRevenue + travelRevenue + overtimeRevenue + otherRevenue) * 100) / 100;

  const campAmount = Number(form.campAmount) || 0;
  const travelling = Number(form.travelling) || 0;
  const overtimeExpense = Number(form.overtimeExpense) || 0;
  const otherExpenses = Number(form.otherExpenses) || 0;
  const totalPayout = Math.round((campAmount + travelling + overtimeExpense + otherExpenses) * 100) / 100;

  const paidAmount = Number(form.paidAmount) || 0;
  const balance = Math.round((totalPayout - paidAmount) * 100) / 100;
  const netContribution = Math.round((totalRevenue - totalPayout) * 100) / 100;

  const punctuality = resolvePunctuality(form.startTime, form.inTime);

  return {
    campSlot,
    totalHours: totalHours ?? '',
    extraHours,
    campRevenue,
    travelRevenue,
    overtimeRevenue,
    otherRevenue,
    otherRevenuePatients,
    otherRevenueDistance,
    totalRevenue,
    totalPayout,
    netContribution,
    balance,
    punctuality,
    revenueAutoCalculated: Boolean(autoRevenue),
    formulaCampRevenue: autoRevenue ? autoRevenue.campRevenue : 0,
    formulaTravelRevenue: autoRevenue ? autoRevenue.travelRevenue : 0,
    formulaOvertimeRevenue: autoRevenue ? autoRevenue.overtimeRevenue : 0,
    formulaOtherRevenue: autoRevenue ? autoRevenue.otherRevenue : 0,
    formulaTotalRevenue: autoRevenue ? autoRevenue.totalRevenue : 0,
  };
}

export function canEditLifecycleStage(campStatus, stage, reachedStage = stage, campContext = {}, { isAdmin = false } = {}) {
  const context = { status: campStatus, ...campContext };
  const reached = normalizeLifecycleStage(reachedStage, 'request');
  const paymentDone = String(context.financePaymentStatus || '').trim() === 'paid';
  if (paymentDone && !isAdmin) return false;

  if (campStatus === 'cancelled') {
    if (stage !== 'financial') return false;
    if (!isExecutionCancellationForFinance(context)) return false;
    return reached === 'financial' || hasReachedLifecycleStage(reached, 'execution');
  }

  if (stage === 'financial') {
    if (reached !== 'financial') return false;
    return ['executed', 'approved', 'cancelled'].includes(campStatus);
  }

  if (reached === 'financial' && !isAdmin) {
    if (stage === 'execution' || stage === 'assignment') return false;
  }

  if (!hasReachedLifecycleStage(reached, stage)) return false;
  if (stage === 'request') {
    return ['pending_review', 'approved', 'rejected', 'executed'].includes(campStatus);
  }
  if (stage === 'assignment') {
    if (['cancelled', 'rejected'].includes(campStatus)) return false;
    return ['approved', 'executed'].includes(campStatus);
  }
  if (stage === 'execution') return ['approved', 'executed'].includes(campStatus);
  return false;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyLifecycleForm() {
  const today = todayIsoDate();
  return {
    clientId: '',
    _id: '',
    campId: '',
    clientName: '',
    campaignName: '',
    campaignType: '',
    source: 'dashboard',
    campDate: '',
    requestDate: today,
    startTime: '09:00',
    endTime: '12:00',
    durationHours: 3,
    campSlot: 'Morning',
    doctorName: '',
    doctorCode: '',
    speciality: DEFAULT_DOCTOR_SPECIALTY,
    hospitalName: '',
    campAddress: '',
    googlePlaceId: '',
    addressManualEntry: true,
    addressPlacesAvailable: false,
    pincode: '',
    city: '',
    state: '',
    district: '',
    stateId: '',
    districtId: '',
    cityId: '',
    hq: '',
    hqManuallyEdited: false,
    zone: '',
    latitude: '',
    longitude: '',
    expectedPatients: 50,
    contactPersons: [{ level: DEFAULT_CONTACT_PERSON_LEVEL, name: '', phone: '' }],
    contactPersonLevel: DEFAULT_CONTACT_PERSON_LEVEL,
    fieldPersonName: '',
    fieldPersonPhone: '',
    assignmentStatus: 'Pending',
    assignmentDecision: '',
    assignmentRefusalReason: '',
    hcwContactId: '',
    hcwCategory: '',
    hcwName: '',
    hcwContact: '',
    executionStatus: EXECUTION_STATUS.CAMP_SCHEDULED,
    cancellationReason: '',
    chargeableStatus: '',
    inTime: '',
    inTimeSelfieUrl: '',
    outTime: '',
    totalHours: '',
    extraHours: 0,
    kmRoundTrip: '',
    punctuality: '',
    attire: '',
    labCoat: '',
    patientsCount: 0,
    rxCount: 0,
    executionDocuments: [],
    consumablesUsed: [],
    campRevenue: 0,
    travelRevenue: 0,
    overtimeRevenue: 0,
    otherRevenue: 0,
    totalRevenue: 0,
    campAmount: 0,
    travelling: 0,
    overtimeExpense: 0,
    otherExpenses: 0,
    totalPayout: 0,
    paidAmount: 0,
    balance: 0,
    transactionId: '',
    paymentRemark: '',
    paymentSubmitStatus: '',
    financePaymentStatus: '',
    expenseCategory: CAMP_FINANCE_EXPENSE_CATEGORY,
    expenseSubCategory: CAMP_FINANCE_EXPENSE_SUB_CATEGORY,
    expenseSubCategoryId: '',
    submittedToFinanceAt: '',
    remarks: '',
    lifecycleStage: 'request',
  };
}

export function campToForm(camp) {
  const startTime = camp.startTime || '09:00';
  const endTime = camp.endTime || '';
  const durationHours = endTime
    ? computeDurationHours(startTime, endTime)
    : (camp.durationHours || 3);

  return {
    ...emptyLifecycleForm(),
    _id: camp._id || '',
    campId: camp.campId || '',
    clientId: resolveCampClientId(camp),
    clientName: camp.clientName || camp.client?.name || '',
    campaignName: camp.campaignName || '',
    campaignType: camp.campaignType || '',
    source: camp.source || 'dashboard',
    campDate: camp.campDate || '',
    requestDate: camp.requestDate || camp.submittedAt?.slice(0, 10) || todayIsoDate(),
    startTime,
    endTime,
    durationHours,
    campSlot: resolveCampSlot(startTime),
    doctorName: camp.doctorName || '',
    doctorCode: camp.doctorCode || '',
    speciality: camp.speciality || DEFAULT_DOCTOR_SPECIALTY,
    hospitalName: camp.hospitalName || '',
    campAddress: camp.campAddress || '',
    googlePlaceId: camp.googlePlaceId || '',
    addressManualEntry: camp.addressManualEntry !== false,
    addressPlacesAvailable: false,
    pincode: camp.pincode || '',
    city: camp.city || camp.district || '',
    state: camp.state || '',
    district: camp.district || '',
    stateId: camp.stateId || '',
    districtId: camp.districtId || '',
    cityId: camp.cityId || '',
    hq: camp.hq || '',
    zone: camp.zone || resolveZoneForState(camp.state) || '',
    latitude: camp.latitude ?? '',
    longitude: camp.longitude ?? '',
    expectedPatients: camp.expectedPatients ?? 50,
    ...syncPrimaryContactFields(normalizeContactPersons(camp)),
    assignmentStatus: camp.assignmentStatus || 'Pending',
    assignmentDecision: camp.assignmentDecision
      || (camp.assignmentRefusalReason ? 'refuse' : (camp.hcwContactId ? 'assign' : '')),
    assignmentRefusalReason: camp.assignmentRefusalReason || '',
    hcwContactId: camp.hcwContactId || '',
    hcwCategory: camp.hcwCategory || '',
    hcwName: camp.hcwName || '',
    hcwContact: camp.hcwContact || '',
    executionStatus: normalizeExecutionStatus(camp.executionStatus) || EXECUTION_STATUS.CAMP_SCHEDULED,
    cancellationReason: camp.cancellationReason || camp.remarks || '',
    chargeableStatus: camp.chargeableStatus || '',
    inTime: camp.inTime || '',
    inTimeSelfieUrl: resolveInTimeSelfieUrl(camp),
    outTime: camp.outTime || '',
    totalHours: camp.totalHours ?? '',
    extraHours: camp.extraHours ?? 0,
    kmRoundTrip: camp.kmRoundTrip ?? '',
    punctuality: camp.punctuality || '',
    attire: camp.attire || '',
    labCoat: camp.labCoat || '',
    patientsCount: camp.patientsCount ?? camp.actualPatients ?? 0,
    rxCount: camp.rxCount ?? 0,
    executionDocuments: Array.isArray(camp.executionDocuments) ? camp.executionDocuments : [],
    consumablesUsed: Array.isArray(camp.consumablesUsed) ? camp.consumablesUsed : [],
    campRevenue: camp.campRevenue ?? 0,
    travelRevenue: camp.travelRevenue ?? 0,
    overtimeRevenue: camp.overtimeRevenue ?? 0,
    otherRevenue: camp.otherRevenue ?? 0,
    totalRevenue: camp.totalRevenue ?? 0,
    campAmount: camp.campAmount ?? 0,
    travelling: camp.travelling ?? 0,
    overtimeExpense: camp.overtimeExpense ?? 0,
    otherExpenses: camp.otherExpenses ?? 0,
    totalPayout: camp.totalPayout ?? 0,
    paidAmount: camp.paidAmount ?? 0,
    balance: camp.balance ?? 0,
    transactionId: camp.transactionId || '',
    paymentRemark: camp.paymentRemark || '',
    paymentSubmitStatus: camp.paymentSubmitStatus || '',
    financePaymentStatus: camp.financePaymentStatus || '',
    expenseCategory: camp.expenseCategory || CAMP_FINANCE_EXPENSE_CATEGORY,
    expenseSubCategory: camp.expenseSubCategory || CAMP_FINANCE_EXPENSE_SUB_CATEGORY,
    expenseSubCategoryId: camp.expenseSubCategoryId || '',
    submittedToFinanceAt: camp.submittedToFinanceAt || '',
    remarks: camp.remarks || '',
    lifecycleStage: normalizeLifecycleStage(camp.lifecycleStage, 'request'),
  };
}
