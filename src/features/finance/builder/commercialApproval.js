/** Mirrors server commercial approver designations (Operations Head OR Senior Manager). */
export const COMMERCIAL_APPROVER_DESIGNATIONS = ['operations head', 'senior manager'];

/** Who may open / edit Organisation master (Admin via *). */
export const ORG_MASTER_EDITOR_DESIGNATIONS = [
  'operations head',
  'senior manager',
  'manager',
];

export function normalizeDesignationKey(designation) {
  return String(designation || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isCommercialApproverDesignation(designation) {
  return COMMERCIAL_APPROVER_DESIGNATIONS.includes(normalizeDesignationKey(designation));
}

export function isOrgMasterEditorDesignation(designation) {
  return ORG_MASTER_EDITOR_DESIGNATIONS.includes(normalizeDesignationKey(designation));
}

/** Admin (*) or Operations Head / Senior Manager designation. */
export function canApproveCommercialDocument(user) {
  if (!user) return false;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return isCommercialApproverDesignation(user.designation);
}

/** Admin (*) or Operations Head / Senior Manager / Manager. */
export function canManageOrganisationMaster(user) {
  if (!user) return false;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return isOrgMasterEditorDesignation(user.designation);
}
