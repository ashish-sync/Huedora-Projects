import { formatDate } from '../../../shared/dateFormat.js';
import { campToForm } from '../constants/campLifecycle.js';

function detailLine(label, value) {
  const text = String(value ?? '').trim() || '—';
  return `${label}: ${text}`;
}

function formatClinicTiming(form = {}) {
  const start = String(form.startTime || '').trim();
  const end = String(form.endTime || '').trim();
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

/** Plain-text block for WhatsApp / email when sharing an assigned camp. */
export function formatCampAssignmentDetails(form = {}) {
  const lines = [
    detailLine('Doctor Name', form.doctorName),
    detailLine('Clinic Date', formatDate(form.campDate) || form.campDate),
    detailLine('Clinic Address', form.campAddress),
    detailLine('Clinic Timing', formatClinicTiming(form)),
    detailLine('Contact Person', form.fieldPersonName),
    detailLine('Contact Number', form.fieldPersonPhone),
    detailLine('HCW Name', form.hcwName),
    detailLine('HCW Number', form.hcwContact),
  ];
  return `${lines.join('\n')}\n`;
}

export function assignmentCopySourceFromCamp(camp = {}) {
  return campToForm(camp);
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
  return copyTextToClipboard(formatCampAssignmentDetails(form, options));
}

export async function copyCampAssignmentDetailsFromRecord(camp, options = {}) {
  return copyCampAssignmentDetails(assignmentCopySourceFromCamp(camp), options);
}
