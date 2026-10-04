import { formatDate } from '../../../shared/dateFormat.js';
import {
  cleanSpaces,
  formatContactPersonName,
  formatDoctorName,
  toProperTitleCase,
} from '../../../shared/textFormat.js';
import { campToForm } from '../constants/campLifecycle.js';
import { campApi, clientMasterApi } from '../campOpsApi.js';
import {
  parseClientMasterListResponse,
  resolveClientMasterDisplayName,
} from './clientMasterCascade.js';

/** Normalize executor URLs to the short /e/:token form used in share copy. */
export function toShortActivityFormUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const base = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://placeholder.local';
    const parsed = new URL(raw, base);
    const match = parsed.pathname.match(/\/(?:camp-execute|e)\/([^/?#]+)\/?$/i);
    if (!match) {
      // Relative /e/token without needing URL parse edge-cases
      const rel = raw.match(/^\/(?:camp-execute|e)\/([^/?#]+)\/?$/i);
      if (rel) return `${base.replace(/\/$/, '')}/e/${rel[1]}`;
      return raw.startsWith('http') ? raw : '';
    }
    return `${parsed.origin}/e/${match[1]}`;
  } catch {
    return raw.startsWith('http') || raw.startsWith('/') ? raw : '';
  }
}

function detailLine(label, value) {
  const text = String(value ?? '').trim() || '—';
  return `*${label}:* ${text}`;
}

function formatClinicTiming(form = {}) {
  const start = String(form.startTime || '').trim();
  const end = String(form.endTime || '').trim();
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

function formatPhone(value) {
  return cleanSpaces(value);
}

function formatAddress(value) {
  return toProperTitleCase(value);
}

function formatExpectedPatients(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resolveClinicAddress(form = {}) {
  return String(form.campAddress || form.hospitalName || form.clinicName || '').trim();
}

function resolveDisplayName(form = {}, options = {}) {
  const direct = String(form.displayName || options.displayName || '').trim();
  if (direct) return direct;
  return resolveClientMasterDisplayName(options.clientMasterRecords || [], {
    campaignType: form.campaignType,
    campaignName: form.campaignName,
  });
}

function resolveCampRecordId(campOrForm = {}, options = {}) {
  const raw = options.campId
    ?? campOrForm._id
    ?? campOrForm.id
    ?? campOrForm.campRefId
    ?? '';
  if (raw && typeof raw === 'object') {
    return String(raw.$oid || raw.toString?.() || '').trim();
  }
  return String(raw || '').trim();
}

/** Plain-text block for WhatsApp / email when sharing an assigned camp. */
export function formatCampAssignmentDetails(form = {}, options = {}) {
  const displayName = String(resolveDisplayName(form, options) || '').trim() || '—';
  const lines = [
    displayName === '—' ? displayName : `*${displayName}*`,
    detailLine('Doctor Name', formatDoctorName(form.doctorName)),
    detailLine('Clinic Date', formatDate(form.campDate) || form.campDate),
    detailLine('Clinic Timing', formatClinicTiming(form)),
    detailLine('Clinic Address', formatAddress(resolveClinicAddress(form))),
  ];

  const expectedPatients = formatExpectedPatients(form.expectedPatients);
  if (expectedPatients != null) {
    lines.push(detailLine('Expected Patients', expectedPatients));
  }

  lines.push(
    detailLine('Contact Person', formatContactPersonName(form.fieldPersonName)),
    detailLine('Contact Number', formatPhone(form.fieldPersonPhone)),
    detailLine('HCW Name', toProperTitleCase(form.hcwName)),
    detailLine('HCW Number', formatPhone(form.hcwContact)),
  );

  const activityFormUrl = toShortActivityFormUrl(options.activityFormUrl || '');
  if (activityFormUrl) {
    lines.push(detailLine('Activity Form', activityFormUrl));
  }

  return `${lines.join('\n')}\n`;
}

export function assignmentCopySourceFromCamp(camp = {}) {
  const form = campToForm(camp);
  // campToForm already syncs contactPersons → fieldPerson*; ensure address fallbacks.
  if (!String(form.campAddress || '').trim()) {
    form.campAddress = String(camp.campAddress || camp.hospitalName || camp.clinicName || '').trim();
  }
  if (!String(form.fieldPersonName || '').trim() && Array.isArray(camp.contactPersons)) {
    const primary = camp.contactPersons[0];
    if (primary) {
      form.fieldPersonName = String(primary.name || primary.fieldPersonName || '').trim();
      form.fieldPersonPhone = String(primary.phone || primary.fieldPersonPhone || '').trim();
    }
  }
  if (form.expectedPatients == null || form.expectedPatients === '') {
    form.expectedPatients = camp.expectedPatients ?? form.expectedPatients;
  }
  // Preserve mongo id for Activity Form mint when list/edit payloads differ.
  if (!form._id) form._id = camp._id || camp.id || '';
  return form;
}

async function resolveCopyOptions(form = {}, options = {}) {
  if (options.clientMasterRecords?.length || options.displayName) {
    return options;
  }

  const clientId = String(form.clientId || '').trim();
  const clientName = String(form.clientName || '').trim();
  if (!clientId && !clientName) return options;

  try {
    const res = clientId
      ? await clientMasterApi.listByClient(clientId, clientName ? { clientName } : undefined)
      : null;
    return {
      ...options,
      clientMasterRecords: parseClientMasterListResponse(res),
    };
  } catch {
    return options;
  }
}

export async function copyTextToClipboard(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
}

export function activityFormUrlFromMintResponse(res) {
  const data = res?.data?.data || res?.data || res || {};
  const direct = toShortActivityFormUrl(data.url || data.path || '');
  if (direct) return direct;
  const token = String(data.token || '').trim();
  if (!token) return '';
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
  return origin ? `${origin}/e/${token}` : `/e/${token}`;
}

/**
 * @returns {Promise<{ url: string, error: string }>}
 */
export async function resolveActivityFormUrl(form = {}, options = {}) {
  const provided = toShortActivityFormUrl(options.activityFormUrl || '');
  if (provided) return { url: provided, error: '' };

  const campId = resolveCampRecordId(form, options);
  if (!campId) {
    return { url: '', error: 'Save the camp before copying an Activity Form link' };
  }

  try {
    const res = await campApi.mintExecutionLink(campId);
    const url = activityFormUrlFromMintResponse(res);
    if (!url) {
      return { url: '', error: 'Activity Form mint returned no link' };
    }
    return { url, error: '' };
  } catch (err) {
    const message = String(err?.message || err || '').trim()
      || 'Activity Form link unavailable';
    console.warn('[camp-assignment-copy] Activity Form link unavailable:', message);
    return { url: '', error: message };
  }
}

/**
 * @returns {Promise<{ copied: boolean, activityFormUrl: string, activityFormError: string, text: string }>}
 */
export async function copyCampAssignmentDetails(form, options = {}) {
  const campId = resolveCampRecordId(form, options);
  const resolvedOptions = await resolveCopyOptions(form, { ...options, campId });
  const { url: activityFormUrl, error: activityFormError } = await resolveActivityFormUrl(form, {
    ...options,
    campId,
  });
  const text = formatCampAssignmentDetails(form, {
    ...resolvedOptions,
    activityFormUrl,
  });
  const copied = await copyTextToClipboard(text);
  return { copied, activityFormUrl, activityFormError, text };
}

/**
 * @returns {Promise<{ copied: boolean, activityFormUrl: string, activityFormError: string, text: string }>}
 */
export async function copyCampAssignmentDetailsFromRecord(camp, options = {}) {
  const campId = resolveCampRecordId(camp, options);
  return copyCampAssignmentDetails(assignmentCopySourceFromCamp(camp), {
    ...options,
    campId,
  });
}
