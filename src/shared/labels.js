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
  LOCATION_MASTER: 'Geography',
  DOCUMENT_MASTER: 'Document Templates',
  DIGITAL_SIGNATURE_MASTER: 'Signatures',
};

/** Sub-navigation and operational screen labels */
export const NAV = {
  ASSET_REGISTER: 'Asset Register',
  STOCK_OVERVIEW: 'Stock Overview',
  OVERVIEW: 'Overview',
  GOODS_RECEIPT: 'Goods Receipt',
  GOODS_ISSUE: 'Goods Issue',
  CONSUMPTION: 'Consumption',
  PRODUCTION_OUTPUT: 'Production Output',
  EXPENSES: 'Expenses',
  INVOICES: 'Invoices',
  PROFORMA: 'Proforma',
  PURCHASE_ORDERS: 'Purchase Orders',
  GENERATE_INVOICE: 'Generate Invoice',
  CHARGESHEET: 'Chargesheet',
  PAYOUT: 'Payout',
  CAMP_HOME: 'Home',
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
  CAMP_MANAGEMENT: 'Camp operations — dashboard, camps, chargesheet, payout, and connectors.',
  ASSET_REQUESTS:
    'Repair, maintenance, goods issue, training, reimbursement, hiring, and master data requests.',
  LOGISTICS: 'Goods receipt (all product types), goods issue, consumption, and production output.',
  INVENTORY_LOGISTICS: 'Goods receipt (all product types), goods issue, consumption, and production output.',
  FINANCE: 'Expenses, proforma, invoices, and client billing.',
  MASTER_DATA: 'Shared reference data for assets, inventory, movements, and documents.',
  DASHBOARD: 'Review cross-module activity by date range.',
};

export const FIELD = {
  ASSET_NAME: 'Asset Name',
  ASSET_TYPE: 'Asset Type',
  ASSET_VALUE: 'Asset Value',
  ASSET_STATUS: 'Asset Status',
  ASSET_CUSTODY: 'Asset Custody',
  CUSTODY: 'Asset Custody',
  CUSTODIAN: 'Custodian',
  CUSTODIAN_NAME: 'Custodian Name',
  CUSTODIAN_CONTACT: 'Custodian Contact',
  CUSTODIAN_CITY: 'Custodian City',
  CUSTODIAN_STATE: 'Custodian State',
  CUSTODIAN_ID: 'Custodian ID',
};
