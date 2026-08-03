/**
 * Standard user-facing copy — keep tone direct, professional, and consistent.
 * Use sentence case; end full sentences with a period.
 */

export const MESSAGES = {
  welcome: (name) => (name ? `Welcome, ${name}` : 'Welcome'),
  saved: (entity) => `${entity} saved successfully.`,
  updated: (entity) => `${entity} updated successfully.`,
  archived: (entity) => `${entity} archived successfully.`,
  deleted: (entity) => `${entity} deleted successfully.`,
  created: (entity) => `${entity} created successfully.`,
  loadFailed: (entity) => `Could not load ${entity}. Please try again.`,
  saveFailed: (entity) => `Could not save ${entity}. Please check the form and try again.`,
  actionFailed: (action) => `Could not ${action}. Please try again.`,
  required: (field) => `${field} is required.`,
  confirmArchive: (entity) => `Archive this ${entity}? You can restore it later if needed.`,
  confirmDelete: (entity) => `Delete this ${entity}? This action cannot be undone.`,
  confirmLogout: 'Are you sure you want to log out?',
  noResults: (entity) => `No ${entity} found.`,
  loading: (entity) => `Loading ${entity}…`,
};

export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.message || err.error?.message || fallback;
}
