/**
 * Turn stored audit rows into a manager-readable Activity Log.
 * Does not change how events are written — presentation only.
 */

export const ACTIVITY_MODULES = [
  { id: 'camp-one', label: 'Camp One' },
  { id: 'finance-one', label: 'Finance One' },
  { id: 'asset-one', label: 'Asset One' },
  { id: 'document-one', label: 'Document One' },
  { id: 'verification-one', label: 'Verification One' },
  { id: 'request-one', label: 'Request One' },
  { id: 'movement-one', label: 'Movement One' },
  { id: 'master-one', label: 'Master One' },
  { id: 'access', label: 'Access Control' },
  { id: 'sign-in', label: 'Sign-in' },
  { id: 'imports', label: 'Imports' },
  { id: 'other', label: 'Other' },
];

export const ACTIVITY_STATUSES = [
  { id: 'SUCCESS', label: 'Completed' },
  { id: 'FAILURE', label: 'Failed' },
];

const MODULE_MATCHERS = [
  { id: 'camp-one', action: /^(camp_ops\.|CampRequest\.|CAMP\.)/i, entity: /camp/i },
  { id: 'finance-one', action: /^(FINANCE\.|finance)/i, entity: /finance|invoice|expense|payout|vendor/i },
  { id: 'asset-one', action: /^(ASSET\.|ASSET_MASTER\.)/i, entity: /asset(?!_request)|device/i },
  { id: 'document-one', action: /^(AGREEMENT\.|DOCUMENT\.|DOCUMENT_TEMPLATE\.)/i, entity: /agreement|document_template/i },
  { id: 'verification-one', action: /^VERIFICATION\./i, entity: /verification/i },
  { id: 'request-one', action: /^(ASSET_REQUEST\.|REPAIR\.)/i, entity: /asset_request|repair/i },
  { id: 'movement-one', action: /^Logistics/i, entity: /logistics/i },
  { id: 'master-one', action: /^(CONTACT\.|GEO|SIGNATURE_MASTER\.|PICKLIST\.|HCW\.)/i, entity: /contact|geo|signature|picklist|hcw/i },
  { id: 'access', action: /^(USER\.(CREATE|UPDATE|DELETE)|ROLE\.|SYSTEM\.)/i, entity: /user|role/i },
  { id: 'sign-in', action: /^USER\.(LOGIN|LOGOUT|TOKEN|PASSWORD|REFRESH)/i, entity: /session|auth/i },
  { id: 'imports', action: /import/i, entity: /import/i },
];

const ACTION_TITLES = {
  'camp_ops.create': 'Created a camp',
  'camp_ops.update': 'Updated a camp',
  'camp_ops.camp_delete': 'Deleted a camp',
  'camp_ops.approve': 'Approved a camp',
  'camp_ops.reject': 'Refused a camp',
  'camp_ops.execute': 'Marked a camp as executed',
  'camp_ops.submit_to_finance': 'Submitted a camp to Finance One',
  'camp_ops.confirm_payment': 'Confirmed camp payment',
  'camp_ops.payment_hold': 'Put camp payment on hold',
  'camp_ops.release_hold': 'Released a camp payment hold',
  'camp_ops.request_information': 'Asked for more camp details',
  'camp_ops.close': 'Closed a camp',
  'camp_ops.import_confirm': 'Imported camps',
  'camp_ops.program_form_create': 'Submitted a camp from the request form',
  'camp_ops.program_form_import': 'Uploaded camps from the request form',
  'camp_ops.client_create': 'Added a camp client',
  'camp_ops.client_update': 'Updated a camp client',
  'camp_ops.client_delete': 'Removed a camp client',
  'camp_ops.client_master_create': 'Added a Client Master record',
  'camp_ops.client_master_update': 'Updated a Client Master record',
  'camp_ops.client_master_delete': 'Removed a Client Master record',
  'camp_ops.execution_docs': 'Uploaded camp execution documents',
  'camp_ops.execution_docs_delete': 'Removed a camp execution document',
  'camp_ops.executor_submit': 'Submitted the Activity Form',
  'USER.LOGIN_SUCCESS': 'Signed in',
  'USER.LOGIN_FAILURE': 'Could not sign in',
  'USER.LOGOUT': 'Signed out',
  'USER.PASSWORD_CHANGE': 'Changed a password',
  'USER.PASSWORD_RESET': 'Reset a password',
  'USER.CREATE': 'Added a user',
  'USER.UPDATE': 'Updated a user',
  'USER.DELETE': 'Removed a user',
  'ROLE.CREATE': 'Created a role',
  'ROLE.UPDATE': 'Updated a role',
  'ROLE.DELETE': 'Removed a role',
  'ASSET.CREATE': 'Registered an asset',
  'ASSET.TRANSITION': 'Changed an asset status',
  'ASSET.AGREEMENT_UPLOAD': 'Attached an agreement to an asset',
  'AGREEMENT.CREATE': 'Created an agreement',
  'AGREEMENT.SEND': 'Sent an agreement',
  'AGREEMENT.SIGN_SENDER': 'Signed an agreement',
  'AGREEMENT.RECIPIENT_SIGN': 'A recipient signed an agreement',
  'AGREEMENT.ACTIVATE': 'Activated an agreement',
  'ASSET_REQUEST.CREATE': 'Created a request',
  'ASSET_REQUEST.APPROVE': 'Approved a request',
  'ASSET_REQUEST.REJECT': 'Refused a request',
  'ASSET_REQUEST.CANCEL': 'Cancelled a request',
  'ASSET_REQUEST.COMPLETE': 'Completed a request',
  'ASSET_REQUEST.FULFILL': 'Fulfilled a request',
  'FINANCE.EXPENSE.CREATE': 'Recorded an expense',
  'FINANCE.EXPENSE.UPDATE': 'Updated an expense',
  'FINANCE.EXPENSE.DELETE': 'Removed an expense',
  'FINANCE.CLIENT_INVOICE.CREATE': 'Prepared a client invoice',
  'FINANCE.CLIENT_INVOICE.ISSUE': 'Issued a client invoice',
  'FINANCE.VENDOR_BILL.CREATE': 'Recorded a vendor bill',
  'FINANCE.VENDOR_BILL.PAY': 'Paid a vendor bill',
  'FINANCE.CAMP_PAYOUT_UPDATE': 'Updated a camp payout',
  'VERIFICATION.CALL_ATTEMPT': 'Logged a verification call',
  'VERIFICATION.LINK_SENT': 'Sent a verification link',
  'CONTACT.CREATE': 'Added a contact',
  'CONTACT.IMPORT': 'Imported contacts',
  'LogisticsInOutEntry.CREATE': 'Recorded a stock movement',
  'LogisticsInOutEntry.UPDATE': 'Updated a stock movement',
  'LogisticsInOutEntry.DELIVERY': 'Marked a movement delivered',
};

const VERB_PAST = {
  create: 'Created',
  created: 'Created',
  update: 'Updated',
  updated: 'Updated',
  delete: 'Deleted',
  deleted: 'Deleted',
  approve: 'Approved',
  approved: 'Approved',
  reject: 'Refused',
  rejected: 'Refused',
  cancel: 'Cancelled',
  cancelled: 'Cancelled',
  send: 'Sent',
  execute: 'Marked as executed',
  import: 'Imported',
  upload: 'Uploaded',
  download: 'Downloaded',
  pay: 'Paid',
  hold: 'Put on hold',
  transition: 'Updated the status of',
};

const SKIP_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'passwordHash',
  'builderForm',
  'attachments',
  'files',
  'productImages',
  'photos',
]);

export function resolveActivityModule(action = '', entityType = '') {
  const a = String(action || '');
  const e = String(entityType || '');
  for (const match of MODULE_MATCHERS) {
    if ((a && match.action.test(a)) || (e && match.entity.test(e))) {
      return ACTIVITY_MODULES.find((m) => m.id === match.id);
    }
  }
  return ACTIVITY_MODULES.find((m) => m.id === 'other');
}

export function activityResultLabel(result) {
  const raw = String(result || '').trim().toUpperCase();
  if (raw === 'SUCCESS' || raw === 'OK' || raw === 'DONE') return 'Completed';
  if (raw === 'FAILURE' || raw === 'FAIL' || raw === 'ERROR') return 'Failed';
  if (!raw) return 'Recorded';
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

export function isFailedResult(result) {
  const raw = String(result || '').trim().toUpperCase();
  return raw === 'FAILURE' || raw === 'FAIL' || raw === 'ERROR';
}

export function activityEmployee(row = {}) {
  const email = String(row.actorEmail || '').trim();
  if (email) return email;
  const type = String(row.actorType || '').trim().toUpperCase();
  if (type === 'SYSTEM' || type === 'JOB') return 'System';
  return 'Someone on the team';
}

function titleFromAction(action) {
  const key = String(action || '').trim();
  if (ACTION_TITLES[key]) return ACTION_TITLES[key];
  const parts = key.split(/[._]+/).filter(Boolean);
  const last = (parts[parts.length - 1] || 'updated').toLowerCase();
  const verb = VERB_PAST[last] || last.replace(/^\w/, (c) => c.toUpperCase());
  const object = inferObject(key);
  return object ? `${verb} ${object}` : `${verb} a record`;
}

function inferObject(action) {
  const a = String(action || '').toLowerCase();
  if (a.includes('camp')) return 'a camp';
  if (a.includes('invoice')) return 'an invoice';
  if (a.includes('expense')) return 'an expense';
  if (a.includes('agreement')) return 'an agreement';
  if (a.includes('asset_request') || a.includes('request')) return 'a request';
  if (a.includes('asset')) return 'an asset';
  if (a.includes('user')) return 'a user';
  if (a.includes('role')) return 'a role';
  if (a.includes('contact')) return 'a contact';
  return '';
}

function pickSubject(row = {}) {
  const src = row.after && typeof row.after === 'object'
    ? row.after
    : row.before && typeof row.before === 'object'
      ? row.before
      : {};
  return String(
    src.campId
    || src.clientName
    || src.fullName
    || src.name
    || src.documentNumber
    || src.invoiceNumber
    || src.title
    || src.assetName
    || src.email
    || '',
  ).trim();
}

function humanField(field) {
  return String(field)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stringifyValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') {
    try {
      const text = JSON.stringify(value);
      return text.length > 160 ? `${text.slice(0, 159)}…` : text;
    } catch {
      return String(value);
    }
  }
  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 159)}…` : text;
}

export function activityChanges(before, after) {
  if (!before || !after) return [];
  const b = typeof before === 'object' ? before : {};
  const a = typeof after === 'object' ? after : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const rows = [];
  for (const key of keys) {
    if (SKIP_FIELDS.has(key) || (key.startsWith('_') && key !== '_id')) continue;
    const from = stringifyValue(b[key]);
    const to = stringifyValue(a[key]);
    if (from === to) continue;
    rows.push({ field: key, label: humanField(key), from, to });
    if (rows.length >= 24) break;
  }
  return rows;
}

export function describeActivity(row = {}) {
  const module = resolveActivityModule(row.action, row.entityType);
  const title = titleFromAction(row.action);
  const employee = activityEmployee(row);
  const subject = pickSubject(row);
  const failed = isFailedResult(row.result);
  const status = activityResultLabel(row.result);
  const where = [module.label, subject].filter(Boolean).join(' · ');
  const summary = failed
    ? `${employee} tried to ${title.charAt(0).toLowerCase()}${title.slice(1)}${subject ? ` (${subject})` : ''}, but it did not complete.`
    : `${employee} ${title.charAt(0).toLowerCase()}${title.slice(1)}${subject ? ` (${subject})` : ''}.`;
  return {
    moduleId: module.id,
    moduleLabel: module.label,
    title,
    summary,
    employee,
    subject,
    where,
    status,
    failed,
    changes: activityChanges(row.before, row.after),
  };
}
