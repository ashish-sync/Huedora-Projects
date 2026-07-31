/** Mirrors server designation bundles for offline UI (API also returns these). */
export const DESIGNATION_ACCESS_TEMPLATES = {
  'healthcare camp coordinator': {
    roleNames: ['Camp Coordinator'],
    summary:
      'Document One, Camp One, Request One, Operations Dashboard & Notifications, and Verification One only.',
    modules: [
      { moduleId: 'agreements', access: 'All' },
      { moduleId: 'camps', access: 'All' },
      { moduleId: 'assetRequests', access: 'Editor, Requester' },
      { moduleId: 'platform', access: 'All' },
      { moduleId: 'verifications', access: 'Viewer' },
    ],
  },
};

export const DESIGNATION_ROLE_NAMES = new Set(['Camp Coordinator']);

export function normalizeDesignationKey(designation) {
  return String(designation || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getDesignationAccessTemplate(designation, templates = DESIGNATION_ACCESS_TEMPLATES) {
  return templates[normalizeDesignationKey(designation)] || null;
}

export function roleIdsForDesignationTemplate(template, roles, roleIdOf) {
  if (!template?.roleNames?.length) return [];
  const ids = [];
  for (const name of template.roleNames) {
    const role = roles.find((r) => r.name === name);
    if (role) ids.push(roleIdOf(role));
  }
  return [...new Set(ids)];
}
