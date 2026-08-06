import { useCallback, useMemo } from 'react';
import { useAuth as useTyloAuth } from '../../shared/auth.jsx';
import { getErrorMessage } from '../../shared/importErrors.js';
import { canSetHistoricalCampDates as canSetHistoricalCampDatesForUser } from './utils/campDatePolicy.js';

/** TYLO role names that grant full camp-ops access (same as HueDora admin / super_admin). */
const ADMIN_ROLE_NAMES = new Set(['admin', 'administrator']);

function roleNamesFromUser(user) {
  const names = [];
  if (user?.role) names.push(String(user.role));
  for (const r of user?.roles || []) {
    names.push(String(r?.name || r || ''));
  }
  return names.map((n) => n.trim().toLowerCase()).filter(Boolean);
}

/**
 * Maps HueDora-style camp-ops permission checks onto TYLO `can()`.
 *
 * TYLO roles (from server ROLE_PERMISSIONS):
 * - Admin (*) → full access (UI may show "Administrator")
 * - CampApprover / Approver → camps:read + camps:approve (+ request for CampApprover)
 * - CampRequester / AssetManager / Viewer → camps:read + camps:request
 *
 * HueDora aliases (camps:create, client-masters:*, …) map onto those TYLO camps:* perms.
 */
export function useCampOpsAuth() {
  const { user, can } = useTyloAuth();

  const roleNames = useMemo(() => roleNamesFromUser(user), [user]);
  const primaryRoleLabel = useMemo(() => {
    const raw = (user?.roles || []).map((r) => r?.name).filter(Boolean);
    if (raw.length) return raw.join(', ');
    if (user?.role) return String(user.role);
    return 'member';
  }, [user]);

  const isAdmin =
    can('*')
    || roleNames.some((n) => ADMIN_ROLE_NAMES.has(n));

  const hasPermission = (permission) => {
    if (!permission) return false;
    if (isAdmin || can('*') || can(permission)) return true;

    const aliases = {
      'camps:create': ['camps:request'],
      'camps:update': ['camps:request', 'camps:approve'],
      'camps:execute': ['camps:approve'],
      'camps:cancel': ['camps:approve'],
      'camps:review': ['camps:approve'],
      'camps:edit-pending': ['camps:approve', 'camps:request'],
      'client-masters:read': ['camps:read'],
      'client-masters:create': ['camps:request'],
      'client-masters:update': ['camps:request', 'camps:approve'],
      'clients:read': ['camps:read'],
      'clients:create': ['camps:request'],
      'clients:update': ['camps:request', 'camps:approve'],
      'communications:read': ['camps:read'],
      'communications:write': ['camps:request', 'camps:approve'],
      'communications:manage': ['camps:request', 'camps:approve'],
      'communications:configure': ['camps:approve', 'users:write'],
      'users:read': ['users:read', 'users:write'],
      'users:write': ['users:write'],
      'users:create': ['users:write'],
      'users:update': ['users:write'],
      'import:execute': ['imports:execute', 'camps:request', 'camps:approve'],
      'import:create': ['imports:execute', 'camps:request', 'camps:approve'],
      'import:read': ['camps:read', 'imports:execute'],
      'dashboard:read': ['camps:read', 'dashboards:read'],
    };

    return (aliases[permission] || []).some((p) => can(p));
  };

  const canApproveCamps = useCallback(
    () => hasPermission('camps:approve') || isAdmin,
    [isAdmin, can],
  );
  const canRejectCamps = useCallback(
    () => hasPermission('camps:approve') || isAdmin,
    [isAdmin, can],
  );
  const canEditCampRecord = useCallback((camp) => {
    const canUpdate = isAdmin || can('*') || can('camps:update') || can('camps:request') || can('camps:approve');
    if (canUpdate) return true;
    const canCreate = can('camps:request');
    if (canCreate && (camp?.status === 'draft' || camp?.status === 'pending_review')) return true;
    return false;
  }, [isAdmin, can]);

  const canSetHistoricalCampDates = useCallback(
    () => canSetHistoricalCampDatesForUser(user),
    [user],
  );

  return {
    user: user
      ? {
          ...user,
          role: primaryRoleLabel,
          name: user.fullName || user.name,
        }
      : user,
    can,
    hasPermission,
    isAdminUser: () => isAdmin || hasPermission('camps:approve'),
    isStrictAdmin: () => isAdmin || can('users:write'),
    isSuperAdmin: () => isAdmin,
    canApproveCamps,
    canRejectCamps,
    canEditCampRecord,
    canSetHistoricalCampDates,
    primaryRoleLabel,
  };
}

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return getErrorMessage(err?.details?.message || err, fallback);
}

/** Alias for ported HueDora pages that import `useAuth`. */
export { useCampOpsAuth as useAuth };
