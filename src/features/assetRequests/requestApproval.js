/**
 * Client mirror of Request One approval matrix (designation / role).
 * Repair & Service: Manager OR Ops Support Team — either may approve once.
 * (Org rename: Operations Leader → Manager, Training Manager → Ops Support Team.)
 * Admin (role, designation, or `*` permission) may approve every request type.
 */

const OPERATIONS_LEADER_ALIASES = new Set([
  'manager',
  'operations leader',
  'operations head',
  'operations manager',
]);

const TRAINING_MANAGER_ALIASES = new Set([
  'ops support team',
  'training manager',
  'training head',
]);

const ADMIN_ALIASES = new Set([
  'admin',
  'administrator',
  'super admin',
  'superadmin',
]);

export function normalizeApproverKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function requiredApproverKeysForType(requestType) {
  const t = String(requestType || '').trim().toUpperCase();
  switch (t) {
    case 'REPAIR':
    case 'MAINTENANCE':
      return ['manager', 'ops support team'];
    case 'LOGISTICS':
    case 'MOVEMENT':
      return ['manager'];
    case 'TRAINING':
      return ['ops support team'];
    case 'HIRING':
      return ['manager'];
    default:
      return [];
  }
}

export function approvalRuleLabel(_requestType) {
  return 'Reporting Manager, or Director / Business Head / Manager';
}

function userApproverKeys(user) {
  const keys = new Set();
  const designation = normalizeApproverKey(user?.designation);
  if (designation) keys.add(designation);
  for (const role of user?.roles || user?.roleIds || []) {
    const name = normalizeApproverKey(role?.name || role);
    if (name) keys.add(name);
  }
  return keys;
}

function matchesRequired(have, requiredKeys) {
  for (const key of requiredKeys) {
    const k = normalizeApproverKey(key);
    if (k === 'manager' || k === 'operations leader') {
      for (const h of have) {
        if (OPERATIONS_LEADER_ALIASES.has(h)) return true;
      }
    } else if (k === 'ops support team' || k === 'training manager') {
      for (const h of have) {
        if (TRAINING_MANAGER_ALIASES.has(h)) return true;
      }
    } else if (have.has(k)) {
      return true;
    }
  }
  return false;
}

export function isAdminApprover(user, can) {
  if (typeof can === 'function' && can('*')) return true;
  if (Array.isArray(user?.permissions) && user.permissions.includes('*')) return true;
  const have = userApproverKeys(user);
  for (const h of have) {
    if (ADMIN_ALIASES.has(h)) return true;
  }
  return false;
}

/**
 * @param {object} user - auth user
 * @param {(perm: string) => boolean} can - auth can()
 * @param {string} requestType
 */
export function canApproveRequestType(user, can, requestType) {
  if (isAdminApprover(user, can)) return true;
  const required = requiredApproverKeysForType(requestType);
  if (required.length) {
    return matchesRequired(userApproverKeys(user), required);
  }
  return (
    (typeof can === 'function' && (can('asset-requests:approve') || can('movements:approve'))) ||
    false
  );
}
