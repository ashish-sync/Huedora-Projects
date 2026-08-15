/**
 * Client mirror of Request One approval matrix (designation / role).
 * Repair & Service: Operations Leader OR Training Manager — either may approve once.
 */

const OPERATIONS_LEADER_ALIASES = new Set([
  'operations leader',
  'operations head',
  'operations manager',
]);

const TRAINING_MANAGER_ALIASES = new Set([
  'training manager',
  'training head',
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
      return ['operations leader', 'training manager'];
    case 'LOGISTICS':
    case 'MOVEMENT':
      return ['operations leader'];
    case 'TRAINING':
      return ['training manager'];
    case 'HIRING':
      return ['operations leader'];
    default:
      return [];
  }
}

export function approvalRuleLabel(requestType) {
  const t = String(requestType || '').trim().toUpperCase();
  switch (t) {
    case 'REPAIR':
    case 'MAINTENANCE':
      return 'Operations Leader or Training Manager';
    case 'LOGISTICS':
    case 'MOVEMENT':
    case 'HIRING':
      return 'Operations Leader';
    case 'TRAINING':
      return 'Training Manager';
    default:
      return 'an authorized approver';
  }
}

function userApproverKeys(user) {
  const keys = new Set();
  const designation = normalizeApproverKey(user?.designation);
  if (designation) keys.add(designation);
  for (const role of user?.roles || []) {
    const name = normalizeApproverKey(role?.name);
    if (name) keys.add(name);
  }
  return keys;
}

function matchesRequired(have, requiredKeys) {
  for (const key of requiredKeys) {
    const k = normalizeApproverKey(key);
    if (k === 'operations leader') {
      for (const h of have) {
        if (OPERATIONS_LEADER_ALIASES.has(h)) return true;
      }
    } else if (k === 'training manager') {
      for (const h of have) {
        if (TRAINING_MANAGER_ALIASES.has(h)) return true;
      }
    } else if (have.has(k)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {object} user - auth user
 * @param {(perm: string) => boolean} can - auth can()
 * @param {string} requestType
 */
export function canApproveRequestType(user, can, requestType) {
  if (typeof can === 'function' && can('*')) return true;
  const required = requiredApproverKeysForType(requestType);
  if (required.length) {
    return matchesRequired(userApproverKeys(user), required);
  }
  return (
    (typeof can === 'function' && (can('asset-requests:approve') || can('movements:approve'))) ||
    false
  );
}
