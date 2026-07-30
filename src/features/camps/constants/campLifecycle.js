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

/** Financial opens once execution stage has been reached (not only after lifecycle is already financial). */
export function canVisitLifecycleStage(reachedStage, targetStage) {
  const target = normalizeLifecycleStage(targetStage, '');
  if (!target) return false;
  if (target === 'financial') {
    return hasReachedLifecycleStage(reachedStage, 'execution');
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
  const blockers = [];
  if (isExecutionClosedOut(camp.executionStatus)) {
    blockers.push('Execution is cancelled or refused');
    return blockers;
  }
  if (normalizeExecutionStatus(camp.executionStatus) !== EXECUTION_STATUS.CAMP_COMPLETED) {
    blockers.push('Set execution status to Camp Completed');
  }
  if (!String(camp.chargeableStatus || '').trim()) {
    blockers.push('Select chargeable status');
  }
  if (!String(camp.inTime || '').trim()) {
    blockers.push('Enter in time on the execution form');
  }
  if (!String(camp.outTime || '').trim()) {
    blockers.push('Enter out time on the execution form');
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
  { value: 'api', label: 'API' },
];

export const CAMP_SLOTS = ['Morning', 'Noon', 'Evening'];
export const ASSIGNMENT_DECISIONS = [
  { value: 'assign', label: 'Assign' },
  { value: 'refuse', label: 'Refuse' },
];
export const ASSIGNMENT_REFUSAL_REASONS = [
  'Refused',
  'Cancelled by TCPL',
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

const LEGACY_EXECUTION_STATUS_ALIASES = {
  Pending: EXECUTION_STATUS.CAMP_SCHEDULED,
  'Yet to Start': EXECUTION_STATUS.CAMP_SCHEDULED,
  'In Progress': EXECUTION_STATUS.CAMP_ONGOING,
  Ongoing: EXECUTION_STATUS.CAMP_ONGOING,
  Executed: EXECUTION_STATUS.MARKED_EXECUTED,
  Completed: EXECUTION_STATUS.CAMP_COMPLETED,
};

export function normalizeExecutionStatus(executionStatus) {
  const value = String(executionStatus || '').trim();
  if (value === 'Rejected') return 'Refused';
  if (LEGACY_EXECUTION_STATUS_ALIASES[value]) return LEGACY_EXECUTION_STATUS_ALIASES[value];
  return value;
}

export function isExecutionClosedOut(executionStatus) {
  return LEGACY_EXECUTION_CLOSED_STATUSES.includes(normalizeExecutionStatus(executionStatus));
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
  const normalized = normalizeExecutionStatus(camp.executionStatus);
  if (normalized === EXECUTION_STATUS.CAMP_COMPLETED) return EXECUTION_STATUS.CAMP_COMPLETED;
  if (isExecutionClosedOut(normalized)) return normalized;
  return resolveScheduledExecutionStatus(camp, now);
}

export function executionStatusClass(status) {
  return `execution-${String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')}`;
}

export function syncExecutionStatusForSave(camp = {}, now = new Date()) {
  const normalized = normalizeExecutionStatus(camp.executionStatus);
  if (normalized === EXECUTION_STATUS.CAMP_COMPLETED) return EXECUTION_STATUS.CAMP_COMPLETED;
  if (isExecutionClosedOut(normalized)) return normalized;
  return resolveScheduledExecutionStatus(camp, now);
}
export const CHARGEABLE_STATUSES = ['Chargeable', 'Non-Chargeable', 'Partial'];
export const QUALITY_RATINGS = ['Good', 'Average', 'Poor'];
export const ATTIRE_CHECK_OPTIONS = ['No Issues', 'Issues'];
export const HCW_CATEGORIES = ['Technician', 'Phlebotomist', 'Dietician', 'Other'];
export const EXECUTION_DOC_TYPES = [
  { value: 'doctor_form', label: 'Doctor Form' },
  { value: 'patient_form', label: 'Patient Form' },
  { value: 'gps_selfie', label: 'GPS Selfie' },
  { value: 'other', label: 'Other document' },
];

export const PAYMENT_SUBMIT_STATUSES = [
  { value: 'payment_confirmed', label: 'Payment Confirmed' },
  { value: 'payment_not_checked', label: 'Payment Not Checked' },
  { value: 'payment_hold', label: 'Payment Hold' },
];

export const FINANCE_PAYMENT_STATUSES = [
  { value: 'not_paid', label: 'Not Paid' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'paid', label: 'Paid' },
];

export function paymentSubmitStatusLabel(value) {
  return PAYMENT_SUBMIT_STATUSES.find((o) => o.value === value)?.label || value || '—';
}

export function financePaymentStatusLabel(value) {
  return FINANCE_PAYMENT_STATUSES.find((o) => o.value === value)?.label || value || '—';
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

export function computeLifecycleDerived(form = {}) {
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

  const campRevenue = Number(form.campRevenue) || 0;
  const overtimeRevenue = Number(form.overtimeRevenue) || 0;
  const otherRevenue = Number(form.otherRevenue) || 0;
  const totalRevenue = Math.round((campRevenue + overtimeRevenue + otherRevenue) * 100) / 100;

  const campAmount = Number(form.campAmount) || 0;
  const travelling = Number(form.travelling) || 0;
  const overtimeExpense = Number(form.overtimeExpense) || 0;
  const otherExpenses = Number(form.otherExpenses) || 0;
  const totalPayout = Math.round((campAmount + travelling + overtimeExpense + otherExpenses) * 100) / 100;

  const paidAmount = Number(form.paidAmount) || 0;
  const balance = Math.round((totalPayout - paidAmount) * 100) / 100;

  const punctuality = resolvePunctuality(form.startTime, form.inTime);

  return {
    campSlot,
    totalHours: totalHours ?? '',
    extraHours,
    totalRevenue,
    totalPayout,
    balance,
    punctuality,
  };
}

export function canEditLifecycleStage(campStatus, stage, reachedStage = stage) {
  if (campStatus === 'cancelled') return false;
  const stageReachable = stage === 'financial'
    ? hasReachedLifecycleStage(reachedStage, 'execution')
    : hasReachedLifecycleStage(reachedStage, stage);
  if (!stageReachable) return false;
  if (stage === 'request') {
    return ['pending_review', 'approved', 'rejected', 'executed'].includes(campStatus);
  }
  if (stage === 'assignment') {
    if (['cancelled', 'rejected'].includes(campStatus)) return false;
    return ['approved', 'executed'].includes(campStatus);
  }
  if (stage === 'execution') return ['approved', 'executed'].includes(campStatus);
  if (stage === 'financial') {
    if (!hasReachedLifecycleStage(reachedStage, 'execution')) return false;
    return ['approved', 'executed'].includes(campStatus);
  }
  return false;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyLifecycleForm() {
  const today = todayIsoDate();
  return {
    clientId: '',
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
    clientId: camp.client?._id || camp.client || '',
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
    submittedToFinanceAt: camp.submittedToFinanceAt || '',
    remarks: camp.remarks || '',
    lifecycleStage: normalizeLifecycleStage(camp.lifecycleStage, 'request'),
  };
}
