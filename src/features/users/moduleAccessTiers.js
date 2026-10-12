/** Per-module access tiers shown in the Control Center. */
export const MODULE_ACCESS_TIERS = [
  { id: 'all', label: 'All' },
  { id: 'viewer', label: 'View', actionIds: ['view'] },
  { id: 'requester', label: 'Request', actionIds: ['request'] },
  { id: 'editor', label: 'Edit', actionIds: ['add', 'delete', 'upload'] },
  { id: 'approver', label: 'Approve', actionIds: ['approve'] },
  { id: 'verifier', label: 'Verify', actionIds: ['verify'] },
  { id: 'payer', label: 'Pay', actionIds: ['pay'] },
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
  if (available.has('all') || Object.keys(module?.actions || {}).length) {
    tiers.push(MODULE_ACCESS_TIERS[0]);
  }
  for (const tier of MODULE_ACCESS_TIERS.slice(1)) {
    if (tier.actionIds.some((id) => available.has(id))) tiers.push(tier);
  }
  return tiers;
}

function availableTier(module) {
  return tiersForModule(module).filter((tier) => tier.id !== 'all');
}

function tierActionKeys(module, tier) {
  const keys = new Set();
  for (const actionId of tier.actionIds || []) {
    for (const key of actionKeys(module, actionId)) keys.add(key);
  }
  return [...keys];
}

/** Action ids that exist on this module for a given tier. */
function activeActionIdsForTier(module, tier) {
  return (tier.actionIds || []).filter((actionId) => actionKeys(module, actionId).length > 0);
}

export function tierIsOn(module, tier, permissions) {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  if (tier.id === 'all') {
    const allKeys = actionKeys(module, 'all');
    if (allKeys.length) return keysGranted(permissions, allKeys);
    return availableTier(module).every((t) => tierIsOn(module, t, permissions));
  }
  const actionIds = activeActionIdsForTier(module, tier);
  if (!actionIds.length) return false;
  // Require every mapped action so Save cannot escalate a partial grant.
  return actionIds.every((actionId) => keysGranted(permissions, actionKeys(module, actionId)));
}

/** Build per-module tier picks from a flat permission list. */
export function moduleMatrixFromPermissions(modules, permissions) {
  const matrix = {};
  if (!permissions?.length) return matrix;
  if (permissions.includes('*')) {
    for (const module of modules) {
      matrix[module.id] = availableTier(module).map((tier) => tier.id);
    }
    return matrix;
  }
  for (const module of modules) {
    const selected = availableTier(module)
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
    const selectable = availableTier(module);
    const allTierIds = selectable.map((tier) => tier.id);
    const useAll = allTierIds.length > 0 && allTierIds.every((id) => selected.has(id));
    if (useAll) {
      const allKeys = actionKeys(module, 'all');
      if (allKeys.length) {
        for (const key of allKeys) keys.add(key);
        continue;
      }
    }
    const tiersToApply = useAll
      ? selectable
      : selectable.filter((tier) => selected.has(tier.id));
    for (const tier of tiersToApply) {
      for (const key of tierActionKeys(module, tier)) keys.add(key);
    }
  }
  return [...keys];
}

/** Permission keys covered by the Control Center catalog. */
export function catalogPermissionKeys(modules = []) {
  return new Set(
    modules.flatMap((module) => Object.values(module?.actions || {}).flat()).filter(Boolean)
  );
}

/**
 * Keep permission keys that the matrix cannot express (e.g. legacy movements:*),
 * so Save does not silently strip them.
 */
export function preserveUnmappedPermissions(modules, grantedPermissions, previousPermissions = []) {
  const catalog = catalogPermissionKeys(modules);
  const next = new Set(grantedPermissions || []);
  for (const key of previousPermissions || []) {
    if (!key || key === '*') continue;
    if (!catalog.has(key)) next.add(key);
  }
  return [...next];
}

export function tierIsOnInMatrix(module, tier, moduleAccess = {}) {
  const selected = new Set(moduleAccess[module.id] || []);
  if (tier.id === 'all') {
    const required = availableTier(module).map((t) => t.id);
    return required.length > 0 && required.every((id) => selected.has(id));
  }
  return selected.has(tier.id);
}

export function toggleModuleTierInMatrix(moduleAccess, module, tier) {
  const next = { ...moduleAccess };
  const current = new Set(next[module.id] || []);
  const selectable = availableTier(module);

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
  // Prefer effective permissions so role-based users hydrate the matrix correctly.
  const effective = Array.isArray(user?.permissions) ? user.permissions : [];
  const stored = Array.isArray(user?.grantedPermissions) ? user.grantedPermissions : [];
  const sourcePermissions = effective.length > 0 ? effective : stored;
  const moduleAccess = moduleMatrixFromPermissions(modules, sourcePermissions);
  return { roleIds, moduleAccess, sourcePermissions };
}
