export const EMAIL_DOMAIN = import.meta.env.VITE_EMAIL_DOMAIN || 'huedoraconnect.com';

export const IS_DEMO_SERVER = import.meta.env.VITE_DEMO_SERVER !== 'false';

export const DEMO_USERS = [
  { label: 'Admin', email: `admin@${EMAIL_DOMAIN}`, password: 'admin123', role: 'Admin' },
  { label: 'Operations', email: `ops@${EMAIL_DOMAIN}`, password: 'admin123', role: 'Operations Executive' },
  { label: 'Reviewer', email: `reviewer@${EMAIL_DOMAIN}`, password: 'admin123', role: 'Reviewer' },
  { label: 'Read Only', email: `viewer@${EMAIL_DOMAIN}`, password: 'admin123', role: 'Read Only' },
];

export const ASSIGNABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'operations_executive', label: 'Operations Executive' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'read_only', label: 'Read Only' },
];

export const ROLE_LABELS = {
  admin: 'Admin',
  operations_executive: 'Operations Executive',
  reviewer: 'Reviewer',
  read_only: 'Read Only',
};

export const SIGNUP_STATUS_LABELS = {
  approved: 'Approved',
  pending: 'Pending approval',
  rejected: 'Rejected',
};

export const ROLE_DESCRIPTIONS = {
  admin: 'Full access to camps, clients, imports, client master, and user management.',
  operations_executive: 'Create and execute camps and manage client master programs. No approvals or user admin.',
  reviewer: 'Review, edit, and approve pending camps. View-only elsewhere.',
  read_only: 'View dashboard, camps, clients, and client master. No changes allowed.',
};

export const PERMISSION_GROUPS = [
  { key: 'camps', label: 'Camps', prefix: 'camps:' },
  { key: 'dashboard', label: 'Dashboard', prefix: 'dashboard:' },
  { key: 'campaigns', label: 'Campaigns', prefix: 'campaigns:' },
  { key: 'clients', label: 'Clients', prefix: 'clients:' },
  { key: 'client-masters', label: 'Client Master', prefix: 'client-masters:' },
  { key: 'import', label: 'Import', prefix: 'import:' },
  { key: 'communications', label: 'Connectors', prefix: 'communications:' },
  { key: 'users', label: 'Users', prefix: 'users:' },
];

export function groupRolePermissions(permissions = []) {
  const grouped = PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: permissions.filter((permission) => permission.startsWith(group.prefix)),
  })).filter((group) => group.items.length > 0);

  const assigned = new Set(grouped.flatMap((group) => group.items));
  const remaining = permissions.filter((permission) => !assigned.has(permission));
  if (remaining.length) {
    grouped.push({ key: 'other', label: 'Other', items: remaining });
  }

  return grouped;
}

export const ROLE_PERMISSIONS = {
  admin: [
    'camps:read', 'camps:create', 'camps:update', 'camps:approve', 'camps:execute',
    'camps:cancel', 'dashboard:read', 'clients:read', 'clients:create',
    'clients:update', 'clients:delete', 'import:read', 'import:create',
    'client-masters:read', 'client-masters:create', 'client-masters:update', 'client-masters:delete',
    'users:read', 'users:create', 'users:update',
    'communications:read', 'communications:manage', 'communications:configure',
  ],
  operations_executive: [
    'dashboard:read', 'clients:read', 'campaigns:read',
    'camps:read', 'camps:create', 'camps:update', 'camps:execute',
    'client-masters:read', 'client-masters:create', 'client-masters:update',
    'communications:read', 'communications:manage', 'communications:configure',
  ],
  reviewer: [
    'camps:read', 'camps:review', 'camps:edit-pending',
    'dashboard:read', 'clients:read', 'campaigns:read', 'client-masters:read',
  ],
  read_only: [
    'camps:read', 'dashboard:read', 'clients:read', 'campaigns:read', 'client-masters:read',
  ],
};

export const PERMISSION_LABELS = {
  'camps:read': 'View camps',
  'camps:create': 'Create camps',
  'camps:update': 'Edit camps',
  'camps:approve': 'Approve camps',
  'camps:execute': 'Execute camps',
  'camps:cancel': 'Cancel camps',
  'camps:review': 'Approve pending camps',
  'camps:edit-pending': 'Edit camps pending review',
  'campaigns:read': 'View campaigns and divisions',
  'dashboard:read': 'View dashboard',
  'clients:read': 'View clients',
  'clients:create': 'Create clients',
  'clients:update': 'Edit clients',
  'clients:delete': 'Archive clients',
  'import:read': 'View import tools',
  'import:create': 'Import camp data',
  'communications:read': 'View communications inbox',
  'communications:manage': 'Sync, extract, and process communications',
  'communications:configure': 'Configure email campaign rules',
  'client-masters:read': 'View client master',
  'client-masters:create': 'Create client master',
  'client-masters:update': 'Edit client master',
  'client-masters:delete': 'Archive client master',
  'users:read': 'View users',
  'users:create': 'Create users',
  'users:update': 'Manage users',
};
