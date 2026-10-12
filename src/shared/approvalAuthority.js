/**
 * Client mirror of Option A approval authority (Request One + Finance One).
 * Standard: only the submitter's Reporting Manager may approve.
 * Exempt: Director, Business Head, any Manager designation, or platform Admin.
 */

export function normalizeDesignationKey(designation) {
  return String(designation || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isApprovalExemptDesignation(designation) {
  const key = normalizeDesignationKey(designation);
  if (!key) return false;
  if (key === 'director' || key.endsWith(' director') || key.startsWith('director ')) return true;
  if (key === 'business head' || key.includes('business head')) return true;
  if (/(^|\s)manager(\s|$)/.test(key)) return true;
  return false;
}

function actorIdOf(user) {
  return String(user?._id || user?.id || '').trim();
}

function collectStar(user, can) {
  if (typeof can === 'function' && can('*')) return true;
  if (Array.isArray(user?.permissions) && user.permissions.includes('*')) return true;
  return false;
}

export function isApprovalAuthorityExempt(user, can) {
  if (collectStar(user, can)) return true;
  return isApprovalExemptDesignation(user?.designation);
}

/**
 * @param {object} actor - auth user
 * @param {object|string} subject - user with _id + reportingManagerId, or id string
 * @param {(perm: string) => boolean} [can]
 */
export function canActorApproveSubject(actor, subject, can) {
  const actorId = actorIdOf(actor);
  const subjectId = String(
    typeof subject === 'object' && subject
      ? subject._id || subject.id
      : subject || ''
  ).trim();
  if (!actorId || !subjectId) return false;
  if (isApprovalAuthorityExempt(actor, can)) return true;
  if (actorId === subjectId) return false;
  const managerId =
    typeof subject === 'object' && subject?.reportingManagerId
      ? String(subject.reportingManagerId._id || subject.reportingManagerId)
      : '';
  return Boolean(managerId && managerId === actorId);
}

export const APPROVAL_AUTHORITY_LABEL =
  'Reporting Manager, or Director / Business Head / Manager';
