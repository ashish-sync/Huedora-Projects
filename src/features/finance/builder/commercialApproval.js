import {
  canActorApproveSubject,
  isApprovalExemptDesignation,
  normalizeDesignationKey,
} from '../../../shared/approvalAuthority.js';

/** Who may open / edit Organisation master (Admin via *). */
export const ORG_MASTER_EDITOR_DESIGNATIONS = [
  'operations head',
  'senior manager',
  'manager',
];

export { normalizeDesignationKey, isApprovalExemptDesignation };

export function isOrgMasterEditorDesignation(designation) {
  return ORG_MASTER_EDITOR_DESIGNATIONS.includes(normalizeDesignationKey(designation));
}

/**
 * Option A: Reporting Manager of submitter, or Director / Business Head / Manager / Admin.
 * @param {object} user
 * @param {object|string|null} subject - approvalSubject or submitter id
 */
export function canApproveCommercialDocument(user, subject = null, can = null) {
  if (!user || !subject) return false;
  return canActorApproveSubject(user, subject, can);
}

/** Admin (*) or Operations Head / Senior Manager / Manager. */
export function canManageOrganisationMaster(user) {
  if (!user) return false;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return isOrgMasterEditorDesignation(user.designation);
}
