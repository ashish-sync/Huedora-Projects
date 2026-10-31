/** Shared business labels for Operations Dashboard review modules. */

export const NOTIFICATION_MODULE_LABELS = {
  camp: 'Camp One',
  finance: 'Finance One',
  assets: 'Asset One / Requests',
  documents: 'Document One',
  masters: 'Master One',
  system: 'Tylo One',
};

export function notificationModuleLabel(module) {
  const key = String(module || 'system').toLowerCase();
  return NOTIFICATION_MODULE_LABELS[key] || 'Tylo One';
}

export function notificationImportanceLabel(priority) {
  const p = String(priority || '').toLowerCase();
  if (p === 'critical') return 'Needs attention now';
  if (p === 'important') return 'Important';
  return 'For your information';
}

export function personStatusLabel(user = {}) {
  return user.isActive === false ? 'Not signing in' : 'Active';
}

export function personRoleLabel(user = {}) {
  const designation = String(user.designation || '').trim();
  if (designation) return designation;
  const roles = (user.roles || []).map((r) => r.name).filter(Boolean);
  if (roles.length) return roles.join(', ');
  return 'Team member';
}

export function importKindLabel(job = {}) {
  const type = String(job.type || job.importType || '').toUpperCase();
  const mode = String(job.mode || '').toUpperCase();
  const checked = mode === 'DRY_RUN' || /DRY/.test(type);
  if (type.includes('VERIFICATION')) {
    return checked ? 'Checked a verification file' : 'Saved verification rows';
  }
  if (type.includes('INVENTORY') || type.includes('ASSET')) {
    return checked ? 'Checked an asset register file' : 'Saved asset register rows';
  }
  return checked ? 'Checked a spreadsheet' : 'Saved spreadsheet rows';
}

export function importStatusLabel(status) {
  const raw = String(status || '').toUpperCase();
  if (raw === 'SUCCEEDED' || raw === 'SUCCESS' || raw === 'COMPLETED') return 'Completed';
  if (raw === 'FAILED' || raw === 'FAIL' || raw === 'ERROR') return 'Needs attention';
  if (raw === 'RUNNING') return 'In progress';
  if (raw === 'QUEUED') return 'Waiting';
  return raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : 'Recorded';
}

export function importOutcomeSummary(job = {}) {
  const total = Number(job.totalRows) || 0;
  const ok = Number(job.successRows) || 0;
  const bad = Number(job.errorRows) || 0;
  const kind = importKindLabel(job);
  const status = importStatusLabel(job.status);
  if (bad > 0) {
    return `${kind}. ${ok} of ${total || ok + bad} rows are ready; ${bad} need attention.`;
  }
  if (total || ok) {
    return `${kind}. ${ok || total} rows ${String(job.mode || '').toUpperCase() === 'DRY_RUN' ? 'look correct' : 'were saved'}.`;
  }
  return `${kind} — ${status.toLowerCase()}.`;
}
