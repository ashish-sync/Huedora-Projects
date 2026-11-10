import { MODULE, MODULE_BLURB } from './labels.js';

/** Shared stroke props for module marks */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.7',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const OPERATIONAL_MODULES = [
  {
    id: 'asset-one',
    to: '/asset-one',
    title: MODULE.ASSET_INVENTORY,
    blurb: MODULE_BLURB.ASSET_INVENTORY,
    tone: 'tone-asset',
    keywords: [
      'asset',
      'inventory',
      'hardware',
      'device',
      'devices',
      'stock',
      'serial',
      'scanner',
      'equipment',
      'medical',
      'qr',
      'custody',
    ],
    canShow: (can) =>
      can('assets:read') ||
      can('assets:write') ||
      can('devices:write') ||
      can('masters:read') ||
      can('logistics:read') ||
      can('logistics:write') ||
      can('logistics:master') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="5" width="16" height="14" rx="2.2" />
        <path d="M4 10h16" />
        <path d="M8 14h3M8 16.5h5" />
        <circle cx="16.5" cy="15.25" r="1.6" />
      </svg>
    ),
  },
  {
    id: 'document-one',
    to: '/document-one',
    title: MODULE.DOCUMENT_HUB,
    blurb: MODULE_BLURB.DOCUMENT_HUB,
    tone: 'tone-document',
    keywords: [
      'document',
      'agreements',
      'contracts',
      'hcw',
      'sign',
      'signatures',
      'mou',
      'pdf',
      'templates',
      'legal',
    ],
    canShow: (can) => can('agreements:read') || can('agreements:write') || can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M7 3.5h7l4 4V19.5A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5v-14A2 2 0 0 1 7 3.5Z" />
        <path d="M14 3.5V8h4.5" />
        <path d="M9 12.2h6M9 15.2h4" />
        <path d="M14.5 18.2 16 19.7l2.8-3" />
      </svg>
    ),
  },
  {
    id: 'verification-one',
    to: '/verification-one',
    title: MODULE.ASSET_VERIFICATION,
    blurb: MODULE_BLURB.ASSET_VERIFICATION,
    tone: 'tone-verify',
    keywords: [
      'verification',
      'verify',
      'audit',
      'physical verification',
      'self verify',
      'photo',
      'gps',
      'geo',
      'checklist',
      'condition',
    ],
    canShow: (can) => can('verifications:read') || can('verifications:write') || can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M12 3.2 5.2 6.2v5.2c0 4.1 2.9 7.7 6.8 8.8 3.9-1.1 6.8-4.7 6.8-8.8V6.2L12 3.2Z" />
        <path d="M9.2 12.1 11.1 14l3.7-3.8" />
      </svg>
    ),
  },
  {
    id: 'camp-one',
    to: '/camp-one/manage',
    title: MODULE.CAMP_MANAGEMENT,
    blurb: MODULE_BLURB.CAMP_MANAGEMENT,
    tone: 'tone-camp',
    keywords: [
      'camp',
      'camps',
      'schedule',
      'planning',
      'execution',
      'attendance',
      'doctor',
      'staff',
      'communication',
      'whatsapp',
      'email',
      'chargesheet',
    ],
    canShow: (can) =>
      can('camps:read') || can('camps:request') || can('camps:approve') || can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M12 21s-6.2-4.9-6.2-10A6.2 6.2 0 0 1 12 4.8a6.2 6.2 0 0 1 6.2 6.2c0 5.1-6.2 10-6.2 10Z" />
        <circle cx="12" cy="11" r="2.15" />
      </svg>
    ),
  },
  {
    id: 'client-one',
    to: '/client-one/hub',
    title: MODULE.CLIENT_ONE,
    blurb: MODULE_BLURB.CLIENT_ONE,
    tone: 'tone-client',
    /** Sidebar group — System (not Operations). Home launcher still lists this module. */
    section: 'system',
    keywords: [
      'client',
      'client one',
      'portal',
      'pin',
      'programme',
      'preview',
      'dashboard',
      'invoice',
      'mis',
    ],
    canShow: (can) =>
      can('camps:read') || can('camps:request') || can('camps:approve') || can('*'),
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8.2" r="2.3" />
        <circle cx="16.2" cy="9" r="1.9" />
        <path d="M4.4 18.8c.7-3.1 2.6-4.7 4.6-4.7 2 0 3.9 1.6 4.6 4.7" />
        <path d="M12.6 18.8c.5-2.2 1.9-3.4 3.5-3.4 1.9 0 3.5 1.5 4.1 3.4" />
      </svg>
    ),
  },
  {
    id: 'request-one',
    to: '/request-one',
    title: MODULE.ASSET_REQUESTS,
    blurb: MODULE_BLURB.ASSET_REQUESTS,
    tone: 'tone-request',
    keywords: [
      'request',
      'requests',
      'asset request',
      'transfer',
      'repair',
      'repairs',
      'maintenance',
      'movement',
      'allocation',
    ],
    canShow: (can) =>
      can('asset-requests:read') ||
      can('asset-requests:request') ||
      can('asset-requests:approve') ||
      can('movements:read') ||
      can('movements:request') ||
      can('movements:approve') ||
      can('repairs:read') ||
      can('repairs:write') ||
      can('maintenance:write') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M8 4.5h8a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6.5a2 2 0 0 1 2-2Z" />
        <path d="M9.5 3.5h5v2.2h-5V3.5Z" />
        <path d="M9.5 11h5M9.5 14.5h3.5" />
        <circle cx="16.2" cy="16.8" r="2.4" />
        <path d="M15.4 16.8h1.6M16.2 16v1.6" />
      </svg>
    ),
  },
  {
    id: 'master-one',
    to: '/master-one',
    title: MODULE.MASTER_DATA,
    blurb: MODULE_BLURB.MASTER_DATA,
    tone: 'tone-master',
    keywords: [
      'master',
      'master data',
      'products',
      'sku',
      'templates',
      'signatures',
      'pincode',
      'pincodes',
      'locations',
      'contacts',
      'vendors',
    ],
    canShow: (can) =>
      can('logistics:master') ||
      can('logistics:write') ||
      can('logistics:read') ||
      can('agreements:write') ||
      can('agreements:read') ||
      can('camps:read') ||
      can('camps:request') ||
      can('camps:approve') ||
      can('finance:read') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <ellipse cx="12" cy="6.5" rx="7" ry="2.6" />
        <path d="M5 6.5v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
        <path d="M5 10.5v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
        <path d="M5 14.5v3c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-3" />
      </svg>
    ),
  },
  {
    id: 'movement-one',
    to: '/movement-one',
    title: MODULE.LOGISTICS,
    blurb: MODULE_BLURB.LOGISTICS,
    tone: 'tone-movement',
    keywords: [
      'movement',
      'logistics',
      'inward',
      'outward',
      'dispatch',
      'courier',
      'consumption',
      'usage',
      'challan',
      'goods',
      'shipping',
    ],
    canShow: (can) =>
      can('logistics:read') ||
      can('logistics:write') ||
      can('logistics:master') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M3 8.2h12.2" />
        <path d="M12.4 5.2 15.8 8.2 12.4 11.2" />
        <path d="M21 15.8H8.8" />
        <path d="M11.6 12.8 8.2 15.8 11.6 18.8" />
        <rect x="3.2" y="13.6" width="4.2" height="4.4" rx="1" />
        <rect x="16.6" y="6" width="4.2" height="4.4" rx="1" />
      </svg>
    ),
  },
  {
    id: 'finance-one',
    to: '/finance-one',
    title: MODULE.FINANCE,
    blurb: MODULE_BLURB.FINANCE,
    tone: 'tone-finance',
    keywords: [
      'finance',
      'billing',
      'invoice',
      'invoices',
      'proforma',
      'purchase order',
      'po',
      'credit note',
      'debit note',
      'payout',
      'payouts',
      'vendor bills',
      'expenses',
      'gst',
      'challan',
    ],
    canShow: (can) => can('finance:read') || can('finance:write') || can('*'),
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 10h8M8 13.5h5" />
        <circle cx="16.2" cy="14.2" r="1.5" />
      </svg>
    ),
  },
];

export function isNavActive(pathname = '', targetPath = '') {
  if (targetPath === '/') {
    return pathname === '/';
  }
  if (targetPath === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  if (targetPath === '/camp-one/manage') {
    return pathname.startsWith('/camp-one');
  }
  if (targetPath === '/client-one/hub') {
    return pathname === '/client-one/hub' || pathname.startsWith('/client-one/preview');
  }
  return pathname.startsWith(targetPath);
}

