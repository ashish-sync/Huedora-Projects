import { formatDate } from '../../../shared/dateFormat.js';
import {
  cleanSpaces,
  formatContactPersonName,
  formatDoctorName,
  toProperTitleCase,
} from '../../../shared/textFormat.js';
import { campToForm } from '../constants/campLifecycle.js';
import { clientMasterApi } from '../campOpsApi.js';
import {
  parseClientMasterListResponse,
  resolveClientMasterDisplayName,
} from './clientMasterCascade.js';

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

function resolveDisplayName(form = {}, options = {}) {
  const direct = String(form.displayName || options.displayName || '').trim();
  if (direct) return direct;
  return resolveClientMasterDisplayName(options.clientMasterRecords || [], {
    campaignType: form.campaignType,
    campaignName: form.campaignName,
  });
}

/** Plain-text block for WhatsApp / email when sharing an assigned camp. */
export function formatCampAssignmentDetails(form = {}, options = {}) {
  const lines = [
    detailLine('Display Name', resolveDisplayName(form, options)),
    detailLine('Doctor Name', formatDoctorName(form.doctorName)),
    detailLine('Clinic Date', formatDate(form.campDate) || form.campDate),
    detailLine('Clinic Timing', formatClinicTiming(form)),
    detailLine('Clinic Address', formatAddress(form.campAddress)),
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

  return `${lines.join('\n')}\n`;
}

export function assignmentCopySourceFromCamp(camp = {}) {
  return campToForm(camp);
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

export async function copyCampAssignmentDetails(form, options = {}) {
  const resolvedOptions = await resolveCopyOptions(form, options);
  return copyTextToClipboard(formatCampAssignmentDetails(form, resolvedOptions));
}

export async function copyCampAssignmentDetailsFromRecord(camp, options = {}) {
  return copyCampAssignmentDetails(assignmentCopySourceFromCamp(camp), options);
}
