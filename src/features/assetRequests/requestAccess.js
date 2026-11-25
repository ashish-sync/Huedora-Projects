/**
 * Client mirror of Request One type-scoped access (Access Control).
 * Keep in sync with Server `modules/assetRequests/requestAccess.js`.
 *
 * View = Super Admin | creator | creator's Reporting Manager | type processor.
 * Process = type manage permission only (never cross-type).
 */

export const TYPE_MANAGE_PERMISSION = Object.freeze({
  REPAIR: 'asset-requests:service:manage',
  MAINTENANCE: 'asset-requests:service:manage',
  LOGISTICS: 'asset-requests:logistics:manage',
  MOVEMENT: 'asset-requests:logistics:manage',
  TRAINING: 'asset-requests:training:manage',
  REIMBURSEMENT: 'asset-requests:finance:manage',
  HIRING: 'asset-requests:hiring:manage',
  OTHER: 'asset-requests:other:manage',
  MASTER_ADD: null,
});

export const ALL_TYPE_MANAGE_PERMISSIONS = Object.freeze([
  'asset-requests:service:manage',
  'asset-requests:logistics:manage',
  'asset-requests:training:manage',
  'asset-requests:finance:manage',
  'asset-requests:hiring:manage',
  'asset-requests:other:manage',
]);

export function normalizeRequestTypeKey(requestType) {
  return String(requestType || '')
    .trim()
    .toUpperCase();
}

export function managePermissionForType(requestType) {
  const t = normalizeRequestTypeKey(requestType);
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(TYPE_MANAGE_PERMISSION, t)) {
    return TYPE_MANAGE_PERMISSION[t];
  }
  return null;
}

function isSuperAdminUser(user) {
  const role = String(user?.systemRole || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return role === 'super admin';
}

export function actorUserId(user) {
  return user?.id || user?._id || null;
}

export function isRequestAdmin(user, can) {
  if (typeof can === 'function' && can('*')) return true;
  if (Array.isArray(user?.permissions) && user.permissions.includes('*')) return true;
  return isSuperAdminUser(user);
}

export function isRequestOwner(user, row) {
  const userId = actorUserId(user);
  if (!userId || !row) return false;
  return String(row.requestorId?._id || row.requestorId) === String(userId);
}

export function isDirectManagerOfRequestor(user, row) {
  const userId = actorUserId(user);
  if (!userId || !row) return false;
  const requestor = row.requestorId;
  if (!requestor || typeof requestor !== 'object') return false;
  const managerId = requestor.reportingManagerId
    ? String(requestor.reportingManagerId._id || requestor.reportingManagerId)
    : '';
  return Boolean(managerId && managerId === String(userId));
}

export function canProcessRequestType(user, can, requestType) {
  if (isRequestAdmin(user, can)) return true;
  const t = normalizeRequestTypeKey(requestType);
  if (!t || t === 'MASTER_ADD') return false;
  const key = managePermissionForType(t);
  if (!key || typeof can !== 'function') return false;
  return can(key);
}

export function canProcessRequest(user, can, row) {
  return canProcessRequestType(user, can, row?.requestType);
}

export function canViewRequest(user, can, row) {
  if (isRequestAdmin(user, can)) return true;
  if (isRequestOwner(user, row)) return true;
  if (isDirectManagerOfRequestor(user, row)) return true;
  return canProcessRequestType(user, can, row?.requestType);
}

export function canCancelRequest(user, can, row) {
  if (isRequestAdmin(user, can)) return true;
  if (isRequestOwner(user, row)) return true;
  return canProcessRequestType(user, can, row?.requestType);
}

export function canMutateRequestAttachments(user, can, row) {
  if (isRequestAdmin(user, can)) return true;
  if (isRequestOwner(user, row)) return true;
  return canProcessRequestType(user, can, row?.requestType);
}

export function cancelRequiresRemark(user, row) {
  return isRequestOwner(user, row);
}
