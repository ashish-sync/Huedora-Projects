/**
 * Who may return a camp from Finance One Payout Queue → Camp One Financial.
 * Keep in sync with server campPayoutReturn.js.
 */

const RETURN_EMAILS = new Set(['zohra@tylocare.com']);
const RETURN_ROLES = new Set(['admin', 'accounts']);
const RETURN_DESIGNATIONS = new Set([
  'accounts',
  'lead - technology & process implementation',
]);

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');
}

export function canReturnCampFromPayoutQueue(user) {
  if (!user) return false;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('*')) return true;

  const email = normalizeKey(user.email);
  if (RETURN_EMAILS.has(email)) return true;

  const fullName = normalizeKey(user.fullName);
  if (fullName.includes('zohra')) return true;

  const designation = normalizeKey(user.designation);
  if (RETURN_DESIGNATIONS.has(designation)) return true;

  for (const role of user.roles || []) {
    const name = normalizeKey(role?.name || role);
    if (RETURN_ROLES.has(name)) return true;
  }

  return false;
}
