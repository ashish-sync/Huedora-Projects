import { computeDurationHours } from '../utils/campSchedule.js';
import { resolveZoneForState } from '../../../constants/geoZones.js';

export const CAMP_LIFECYCLE_STAGES = [
  { id: 'request', label: 'Request Stage', short: 'Request' },
  { id: 'assignment', label: 'Resource Assignment', short: 'Assignment' },
  { id: 'execution', label: 'Camp Execution', short: 'Execution' },
  { id: 'financial', label: 'Finance & Settlement', short: 'Financial' },
];

export function lifecycleStageIndex(stage) {
  return CAMP_LIFECYCLE_STAGES.findIndex((s) => s.id === stage);
}

export function hasReachedLifecycleStage(reachedStage, targetStage) {
  const reached = lifecycleStageIndex(reachedStage || 'request');
  const target = lifecycleStageIndex(targetStage);
  if (reached < 0 || target < 0) return false;
  return target <= reached;
}

export function maxLifecycleStage(a, b) {
  return lifecycleStageIndex(a) >= lifecycleStageIndex(b) ? a : b;
}

export const CAMP_SOURCE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'excel', label: 'Excel Import' },
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
export const EXECUTION_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'Rejected'];
export const EXECUTION_CLOSED_STATUSES = ['Cancelled', 'Rejected'];

export function isExecutionClosedOut(executionStatus) {
  return EXECUTION_CLOSED_STATUSES.includes(String(executionStatus || '').trim());
}
export const CHARGEABLE_STATUSES = ['Chargeable', 'Non-Chargeable', 'Partial'];
export const QUALITY_RATINGS = ['Good', 'Average', 'Poor'];
export const ATTIRE_CHECK_OPTIONS = ['No Issues', 'Issues'];
export const HCW_CATEGORIES = ['Technician', 'Phlebotomist', 'Dietician', 'Other'];
export const EXECUTION_DOC_TYPES = [
  { value: 'doctor_form', label: 'DF (Doctor Form)' },
  { value: 'patient_form', label: 'PF (Patient Form)' },
  { value: 'other', label: 'Others' },
  { value: 'gps_selfie', label: 'GPS Selfie' },
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
 * Punctuality from camp start vs in time:
 * on time / early through 5 min late → Good; 5–15 min late → Average; 15+ min late → Poor.
 */
export function resolvePunctuality(campStartTime, inTime) {
  const startMins = parseTimeToMinutes(campStartTime);
  const inMins = parseTimeToMinutes(inTime);
  if (startMins == null || inMins == null) return '';

  let lateMinutes = inMins - startMins;
  if (lateMinutes < -12 * 60) lateMinutes += 24 * 60;
  if (lateMinutes > 12 * 60) lateMinutes -= 24 * 60;

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
    campAddress: '',
    pincode: '',
    city: '',
    state: '',
    district: '',
    stateId: '',
    districtId: '',
    cityId: '',
    hq: '',
    zone: '',
    expectedPatients: 50,
    fieldPersonName: '',
    fieldPersonPhone: '',
    assignmentStatus: 'Pending',
    assignmentDecision: '',
    assignmentRefusalReason: '',
    hcwContactId: '',
    hcwCategory: '',
    hcwName: '',
    hcwContact: '',
    executionStatus: 'Pending',
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
    campAddress: camp.campAddress || '',
    pincode: camp.pincode || '',
    city: camp.city || camp.district || '',
    state: camp.state || '',
    district: camp.district || '',
    stateId: camp.stateId || '',
    districtId: camp.districtId || '',
    cityId: camp.cityId || '',
    hq: camp.hq || '',
    zone: camp.zone || resolveZoneForState(camp.state) || '',
    expectedPatients: camp.expectedPatients ?? 50,
    fieldPersonName: camp.fieldPersonName || '',
    fieldPersonPhone: camp.fieldPersonPhone || '',
    assignmentStatus: camp.assignmentStatus || 'Pending',
    assignmentDecision: camp.assignmentDecision
      || (camp.assignmentRefusalReason ? 'refuse' : (camp.hcwContactId ? 'assign' : '')),
    assignmentRefusalReason: camp.assignmentRefusalReason || '',
    hcwContactId: camp.hcwContactId || '',
    hcwCategory: camp.hcwCategory || '',
    hcwName: camp.hcwName || '',
    hcwContact: camp.hcwContact || '',
    executionStatus: camp.executionStatus || 'Pending',
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
    lifecycleStage: camp.lifecycleStage || 'request',
  };
}
