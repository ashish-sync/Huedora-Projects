import {
  campManageEditPath,
  documentOneDetailPath,
  MODULE_PATH,
  FINANCE_PATH,
  CAMP_PATH,
} from '../../shared/moduleRoutes.js';

/** Deep-link path for a notification entity, or null if unknown. */
export function notificationEntityPath(n) {
  if (n?.meta?.deepLinkHint === 'camp_manage' && !n?.entityId) {
    return CAMP_PATH.MANAGE;
  }
  if (!n?.entityType || !n?.entityId) {
    if (n?.meta?.deepLinkHint === 'camp_manage') {
      return CAMP_PATH.MANAGE;
    }
    return null;
  }
  const id = String(n.entityId);
  switch (String(n.entityType)) {
    case 'camp_ops_camp':
    case 'Camp':
      return campManageEditPath(id);
    case 'AssetRequest':
      return `${MODULE_PATH.REQUEST_ONE}?requestId=${encodeURIComponent(id)}`;
    case 'Movement':
      return `${MODULE_PATH.REQUEST_ONE}?movementId=${encodeURIComponent(id)}`;
    case 'Agreement':
      return documentOneDetailPath(id);
    case 'VerificationRecord':
      return `${MODULE_PATH.VERIFICATION_ONE}?recordId=${encodeURIComponent(id)}`;
    case 'FinanceCommercialDocument':
      return `${FINANCE_PATH.BILLING}?docId=${encodeURIComponent(id)}`;
    default:
      return null;
  }
}

export function priorityLabel(priority) {
  const p = String(priority || 'informational').toLowerCase();
  if (p === 'critical') return 'Critical';
  if (p === 'important') return 'Important';
  return 'Informational';
}

export function priorityClass(priority) {
  const p = String(priority || 'informational').toLowerCase();
  return `nc-priority nc-priority--${p}`;
}

/** Human category for inbox grouping / chips. */
export function categoryLabel(n) {
  const type = String(n?.type || '');
  const module = String(n?.module || 'system').toLowerCase();
  if (/BULK/i.test(type)) return 'Bulk action';
  if (/OVERDUE|REJECT|CRITICAL|IMPORT_ERRORS|RETENTION/i.test(type)) return 'Alert';
  if (module === 'camp') return 'Camp';
  if (module === 'finance') return 'Finance';
  if (module === 'assets') return 'Assets';
  if (module === 'documents') return 'Documents';
  if (module === 'masters') return 'Masters';
  return 'System';
}
