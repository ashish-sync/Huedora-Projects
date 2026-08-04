import { formatDate } from '../../../shared/dateFormat.js';
import {
  cleanSpaces,
  formatDoctorName,
  toProperTitleCase,
} from '../../../shared/textFormat.js';
import { campToForm } from '../constants/campLifecycle.js';
import { normalizeCampMethodKey } from '../constants/campNames.js';
import { normalizeHealthcareWorkers } from './healthcareWorkers.js';

const HIRING_HCW_TYPES = ['Phlebotomist', 'Technician', 'Dietitian', 'Physio', 'Others'];
const HIRING_CAMP_TYPES = ['No Device', 'Light Device (1-5 KG)', 'Heavy Device (5-12 KG)'];

function hireRequestSource(source = {}) {
  const fromCamp = campToForm(source);
  return {
    ...fromCamp,
    ...source,
    campId: source.campId || fromCamp.campId,
    clientName: source.clientName || fromCamp.clientName,
    _id: source._id || fromCamp._id,
  };
}

function mapHcwTypeFromRoles(roles = []) {
  const normalized = normalizeHealthcareWorkers(roles);
  for (const role of normalized) {
    const key = String(role || '').trim().toLowerCase();
    if (key === 'dietician' || key === 'dietitian') return 'Dietitian';
    const match = HIRING_HCW_TYPES.find((option) => option.toLowerCase() === key);
    if (match) return match;
  }
  if (normalized[0]) return 'Others';
  return '';
}

function mapCampTypeFromServiceModel(value = '') {
  const raw = cleanSpaces(value);
  if (!raw) return '';
  const exact = HIRING_CAMP_TYPES.find((option) => option.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const key = raw.toLowerCase();
  // Service Model → Hiring Camp type
  // HCW Only / Rented = No Device
  if (key === 'hcw only' || key === 'rented' || key.includes('no device')) {
    return 'No Device';
  }
  if (key.includes('heavy')) return 'Heavy Device (5-12 KG)';
  if (key.includes('light') || key.includes('hcw + device') || key === 'device only') {
    return 'Light Device (1-5 KG)';
  }
  return '';
}

/**
 * Prefill Hiring Request fields from a camp + matching Client Master row.
 * Leaves hiringType, budgetMin, budgetMax, and remarks (reason) empty.
 */
export function mapCampToHiringPrefill(camp = {}, clientMaster = null) {
  const form = hireRequestSource(camp);
  const method = normalizeCampMethodKey(
    form.campaignName || clientMaster?.campName || '',
  );
  const roles = normalizeHealthcareWorkers(
    clientMaster?.healthcareWorker ?? form.healthcareWorker,
  );

  return {
    requestType: 'HIRING',
    hiringType: '',
    budgetMin: '',
    budgetMax: '',
    reason: '',
    hcwType: mapHcwTypeFromRoles(roles),
    campType: mapCampTypeFromServiceModel(clientMaster?.campType || form.campType),
    hiringMethod: method,
    hiringState: toProperTitleCase(form.state),
    hiringCity: toProperTitleCase(form.city),
    hiringDistrict: toProperTitleCase(form.district),
    hiringAddress: toProperTitleCase(form.campAddress),
    hiringPinCode: cleanSpaces(form.pincode),
    engagementDateTime: form.campDate || '',
  };
}

export function formatLinkedCampSummary(camp = {}) {
  const form = hireRequestSource(camp);
  const parts = [
    cleanSpaces(form.campId),
    formatDoctorName(form.doctorName),
    formatDate(form.campDate) || cleanSpaces(form.campDate),
    [toProperTitleCase(form.city), toProperTitleCase(form.state)].filter(Boolean).join(', '),
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Opens Request One pre-set to Hiring Request for this camp.
 */
export function buildCampHireRequestPath(source = {}, options = {}) {
  const form = hireRequestSource(source);
  const params = new URLSearchParams({ type: 'HIRING' });

  const recordId = cleanSpaces(form._id);
  if (recordId) params.set('campRecordId', recordId);

  const campId = cleanSpaces(form.campId);
  if (campId) params.set('campId', campId);

  const roles = normalizeHealthcareWorkers(
    options.professions ?? options.profession ?? form.healthcareWorker ?? [],
  );
  if (roles.length) params.set('roles', roles.join(','));

  return `/request-one?${params.toString()}`;
}

/** @deprecated Prefer buildCampHireRequestPath */
export function openCampHireRequestEmail(source = {}, options = {}) {
  const path = buildCampHireRequestPath(source, options);
  if (typeof window !== 'undefined') {
    window.location.assign(path);
  }
  return path;
}
