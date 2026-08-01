/** Per-module access tiers shown in the Control Center. */
export const MODULE_ACCESS_TIERS = [
  { id: 'all', label: 'All' },
  { id: 'viewer', label: 'Viewer', actionIds: ['view'] },
  { id: 'requester', label: 'Requester', actionIds: ['request'] },
  { id: 'editor', label: 'Editor', actionIds: ['add', 'delete', 'upload'] },
  { id: 'approver', label: 'Approver', actionIds: ['approve'] },
];

export function accessActionIds(module) {
  return Object.keys(module?.actions || {}).filter((id) => module.actions[id]?.length);
}

export function actionKeys(module, actionId) {
  return module?.actions?.[actionId] || [];
}

export function keysGranted(permissions, keys) {
  if (!keys.length) return false;
  const set = new Set(permissions || []);
  if (set.has('*')) return true;
  return keys.every((k) => set.has(k));
}

export function tiersForModule(module) {
  const available = new Set(accessActionIds(module));
  const tiers = [];
  if (available.has('all')) tiers.push(MODULE_ACCESS_TIERS[0]);
  for (const tier of MODULE_ACCESS_TIERS.slice(1)) {
    if (tier.actionIds.some((id) => available.has(id))) tiers.push(tier);
  }
  return tiers;
}

function tierActionKeys(module, tier) {
  const keys = new Set();
  for (const actionId of tier.actionIds || []) {
    for (const key of actionKeys(module, actionId)) keys.add(key);
  }
  return [...keys];
}

export function tierIsOn(module, tier, permissions) {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  if (tier.id === 'all') {
    return tiersForModule(module)
      .filter((t) => t.id !== 'all')
      .every((t) => tierIsOn(module, t, permissions));
  }
  return tier.actionIds.some((actionId) => {
    const keys = actionKeys(module, actionId);
    return keys.length && keysGranted(permissions, keys);
  });
}

/** Build per-module tier picks from a flat permission list. */
export function moduleMatrixFromPermissions(modules, permissions) {
  const matrix = {};
  if (!permissions?.length) return matrix;
  if (permissions.includes('*')) {
    for (const module of modules) {
      matrix[module.id] = tiersForModule(module)
        .filter((tier) => tier.id !== 'all')
        .map((tier) => tier.id);
    }
    return matrix;
  }
  for (const module of modules) {
    const selected = tiersForModule(module)
      .filter((tier) => tier.id !== 'all')
      .filter((tier) => tierIsOn(module, tier, permissions))
      .map((tier) => tier.id);
    if (selected.length) matrix[module.id] = selected;
  }
  return matrix;
}

/** Flatten per-module tier picks into backend permission keys. */
export function permissionsFromModuleMatrix(modules, moduleAccess = {}) {
  const keys = new Set();
  for (const module of modules) {
    const selected = new Set(moduleAccess[module.id] || []);
    if (!selected.size) continue;
    const selectable = tiersForModule(module).filter((tier) => tier.id !== 'all');
    const allTierIds = selectable.map((tier) => tier.id);
    const useAll = allTierIds.length > 0 && allTierIds.every((id) => selected.has(id));
    const tiersToApply = useAll
      ? selectable
      : selectable.filter((tier) => selected.has(tier.id));
    for (const tier of tiersToApply) {
      for (const key of tierActionKeys(module, tier)) keys.add(key);
    }
  }
  return [...keys];
}

export function tierIsOnInMatrix(module, tier, moduleAccess = {}) {
  const selected = new Set(moduleAccess[module.id] || []);
  if (tier.id === 'all') {
    const required = tiersForModule(module).filter((t) => t.id !== 'all').map((t) => t.id);
    return required.length > 0 && required.every((id) => selected.has(id));
  }
  return selected.has(tier.id);
}

export function toggleModuleTierInMatrix(moduleAccess, module, tier) {
  const next = { ...moduleAccess };
  const current = new Set(next[module.id] || []);
  const selectable = tiersForModule(module).filter((t) => t.id !== 'all');

  if (tier.id === 'all') {
    const allIds = selectable.map((t) => t.id);
    const allOn = allIds.length > 0 && allIds.every((id) => current.has(id));
    next[module.id] = allOn ? [] : allIds;
    return next;
  }

  if (current.has(tier.id)) {
    current.delete(tier.id);
  } else {
    current.add(tier.id);
  }
  next[module.id] = [...current];
  return next;
}

export function hasAnyModuleAccess(moduleAccess = {}) {
  return Object.values(moduleAccess).some((tiers) => tiers?.length);
}

export function buildUserAccessDraft(user, modules, roles, roleIdOf) {
  const roleIds = (user?.roles || []).map(roleIdOf).filter(Boolean);
  const stored = Array.isArray(user?.grantedPermissions) ? user.grantedPermissions : [];
  const sourcePermissions = stored.length > 0 ? stored : user?.permissions || [];
  const moduleAccess = moduleMatrixFromPermissions(modules, sourcePermissions);
  return { roleIds, moduleAccess };
}
