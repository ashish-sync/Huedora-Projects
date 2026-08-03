/** Canonical user-facing module and field labels for TYLO One (ERP-aligned). */
export const MODULE = {
  HOME: 'Home',
  DASHBOARD: 'Operations Dashboard',
  DOCUMENT_HUB: 'Document One',
  /** @deprecated Prefer DOCUMENT_HUB */
  ASSET_AGREEMENT: 'Document One',
  ASSET_INVENTORY: 'Asset One',
  /** @deprecated Prefer ASSET_INVENTORY */
  ASSET_MASTER: 'Asset One',
  ASSET_VERIFICATION: 'Verification One',
  CAMP_MANAGEMENT: 'Camp One',
  ASSET_REQUESTS: 'Request One',
  LOGISTICS: 'Movement One',
  /** @deprecated Prefer LOGISTICS */
  INVENTORY_LOGISTICS: 'Movement One',
  FINANCE: 'Finance One',
  MASTER_DATA: 'Master One',
  ROLES_PERMISSIONS: 'Access Control',
  CONTACT_DIRECTORY: 'Contact Directory',
  CLIENT_MASTER: 'Client Master',
  LOCATION_MASTER: 'PIN Geography',
  DOCUMENT_MASTER: 'Document Templates',
  DIGITAL_SIGNATURE_MASTER: 'Signatures',
  /** Standard field labels */
  MOBILE_NUMBER: 'Mobile number',
  EMAIL: 'Email',
  METHOD: 'Method',
  DIVISION_THERAPY: 'Division / Therapy',
  SERVICE_MODEL: 'Service Model',
};

/** Sub-navigation and operational screen labels */
export const NAV = {
  ASSET_REGISTER: 'Asset Register',
  STOCK_OVERVIEW: 'Stock Overview',
  OVERVIEW: 'Overview',
  ASSETS_OVERVIEW: 'Assets Overview',
  GOODS_RECEIPT: 'Goods Receipt',
  GOODS_ISSUE: 'Goods Issue',
  CONSUMPTION: 'Consumption',
  PRODUCTION_OUTPUT: 'Production Output',
  EXPENSES: 'Expenses',
  INVOICES: 'Invoices',
  PROFORMA: 'Proforma',
  PURCHASE_ORDERS: 'Purchase Orders',
  GENERATE: 'Generate',
  INVOICE_BUILDER: 'Invoice Builder',
  CAMP_PAYOUTS: 'Payout Queue',
  PAYOUT_QUEUE: 'Payout Queue',
  ORG_MASTER: 'Organisation',
  CHARGESHEET: 'Chargesheet',
  PAYOUT: 'Payout',
  CAMP_HOME: 'Home',
  CAMP_CREATE: 'Create Camps',
  CAMP_CREATE_MANUAL_PASTE: 'Manual Paste',
  CAMP_CREATE_EMAIL: 'Email',
  CAMP_CREATE_UPLOAD: 'Camp Upload',
  CAMP_CREATE_DOWNLOAD: 'Camp Download',
  CAMP_MANAGE: 'Manage Camps',
  CAMP_REQUESTS: 'Requests',
  CAMP_SCHEDULE: 'Schedule',
  CAMP_REPORTS: 'Reports',
  CAMP_RESOURCES: 'Resources',
};

/** Short module blurbs for home / catalogs */
export const MODULE_BLURB = {
  ASSET_INVENTORY: 'Agreements and custody for Medical and Non-Medical Devices.',
  DOCUMENT_HUB: 'Create, send, and track contracts.',
  ASSET_VERIFICATION: 'Photo and GPS checks with audit history.',
  CAMP_MANAGEMENT: 'Camp operations — camps, lifecycle stages, and connectors.',
  ASSET_REQUESTS:
    'Repair & Service, Goods Issuance, Training, Finance One, Hiring, Master One, and Other requests.',
  LOGISTICS: 'Goods receipt (all product types), goods issue, consumption, and production output.',
  INVENTORY_LOGISTICS: 'Goods receipt (all product types), goods issue, consumption, and production output.',
  FINANCE: 'Payout queue, tax invoices, proforma, purchase orders, and credit notes.',
  MASTER_DATA:
    'Products, Expense Master, Contact Directory, Document Templates, Signatures, Client Master, and PIN Geography.',
  DASHBOARD: 'Executive project health and module drill-down by date range.',
};

export const FIELD = {
  ASSET_TYPE: 'Asset Type (Product Type)',
  ASSET_NAME: 'Asset Name',
  ASSET_PERIPHERAL_DETAILS: 'Asset / Peripheral Details',
  OWNERSHIP_TYPE: 'Ownership Type',
  ASSET_VALUE: 'Asset Value',
  ASSET_STATUS: 'Asset Status',
  ASSET_CUSTODY: 'Asset Custody',
  ALL_ASSET_STATUSES: 'All Asset Statuses',
  ALL_ASSET_CUSTODY: 'All Asset Custody',
  CUSTODY: 'Asset Custody',
  CUSTODIAN: 'Custodian',
  CUSTODIAN_NAME: 'Custodian Name',
  CUSTODIAN_CONTACT: 'Custodian Contact',
  CUSTODIAN_CITY: 'Custodian City',
  CUSTODIAN_STATE: 'Custodian State',
  CUSTODIAN_ID: 'Custodian ID',
};

/** Shared filter / toolbar dropdown labels (Title Case). */
export const FILTER = {
  ALL_STATUSES: 'All Statuses',
  ALL_TYPES: 'All Types',
  ALL_CAMPS: 'All Camps',
};

/** Standard toolbar / header action labels (Excel export, sample, import). */
export const ACTION = {
  DOWNLOAD: 'Download',
  DOWNLOAD_EXCEL: 'Download Excel',
  DOWNLOADING: 'Downloading…',
  SAMPLE_FORMAT: 'Sample format',
  IMPORT: 'Import',
  IMPORTING: 'Importing…',
  EXPORTING: 'Exporting…',
};

/** Contextual bulk export label, e.g. "Download all camps". */
export function downloadAllLabel(noun) {
  const trimmed = String(noun || '').trim();
  return trimmed ? `Download all ${trimmed}` : ACTION.DOWNLOAD;
}
