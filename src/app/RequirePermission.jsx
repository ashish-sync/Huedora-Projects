import { Navigate } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';

/**
 * Soft UX gate for module routes. Backend authorization remains the security boundary.
 * Users without any of the listed permissions are sent home instead of loading a dead module.
 *
 * When `requireSuperAdmin` is true, only platform System Role Super Admin may enter
 * (RBAC `*` alone is not enough).
 */
export default function RequirePermission({ anyOf = [], requireSuperAdmin = false, children }) {
  const { can, loading, user, isSuperAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperAdmin) {
    if (!isSuperAdmin?.()) {
      return <Navigate to="/" replace state={{ forbidden: true, needed: ['systemRole:Super Admin'] }} />;
    }
    return children;
  }
  if (can('*')) return children;
  const allowed = (anyOf || []).some((perm) => can(perm));
  if (!allowed) {
    return <Navigate to="/" replace state={{ forbidden: true, needed: anyOf }} />;
  }
  return children;
}
