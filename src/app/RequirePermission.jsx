import { Navigate } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';

/**
 * Soft UX gate for module routes. Backend authorization remains the security boundary.
 * Users without any of the listed permissions are sent home instead of loading a dead module.
 */
export default function RequirePermission({ anyOf = [], children }) {
  const { can, loading, user } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (can('*')) return children;
  const allowed = (anyOf || []).some((perm) => can(perm));
  if (!allowed) {
    return <Navigate to="/" replace state={{ forbidden: true, needed: anyOf }} />;
  }
  return children;
}
