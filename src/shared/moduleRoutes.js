/**
 * Canonical Module One URL prefixes and helpers.
 * Prefer these over hard-coded legacy paths (/finance, /camps, /agreements, …).
 */

export const MODULE_PATH = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ASSET_ONE: '/asset-one',
  DOCUMENT_ONE: '/document-one',
  VERIFICATION_ONE: '/verification-one',
  CAMP_ONE: '/camp-one',
  REQUEST_ONE: '/request-one',
  MASTER_ONE: '/master-one',
  MOVEMENT_ONE: '/movement-one',
  FINANCE_ONE: '/finance-one',
  ACCESS_CONTROL: '/access-control',
  IMPORTS: '/imports',
  AUDIT: '/audit',
  NOTIFICATIONS: '/notifications',
};

/** Finance One sub-routes */
export const FINANCE_PATH = {
  ROOT: MODULE_PATH.FINANCE_ONE,
  BILLING: `${MODULE_PATH.FINANCE_ONE}/billing`,
  INVOICE: `${MODULE_PATH.FINANCE_ONE}/billing/invoice`,
  PROFORMA: `${MODULE_PATH.FINANCE_ONE}/billing/proforma`,
  PURCHASE_ORDER: `${MODULE_PATH.FINANCE_ONE}/billing/purchase-order`,
  CREDIT_NOTE: `${MODULE_PATH.FINANCE_ONE}/billing/credit-note`,
  ORGANISATION: `${MODULE_PATH.FINANCE_ONE}/organisation`,
  PAYOUTS: `${MODULE_PATH.FINANCE_ONE}/payouts`,
  VENDOR_BILLS: `${MODULE_PATH.FINANCE_ONE}/vendor-bills`,
};

/** Camp One sub-routes */
export const CAMP_PATH = {
  ROOT: MODULE_PATH.CAMP_ONE,
  MANAGE: `${MODULE_PATH.CAMP_ONE}/manage`,
  MANAGE_NEW: `${MODULE_PATH.CAMP_ONE}/manage/new`,
  COMMUNICATIONS: `${MODULE_PATH.CAMP_ONE}/communications`,
  PASTE: `${MODULE_PATH.CAMP_ONE}/communications/paste`,
  EMAIL: `${MODULE_PATH.CAMP_ONE}/communications/email`,
  UPLOAD: `${MODULE_PATH.CAMP_ONE}/communications/upload`,
  DOWNLOAD: `${MODULE_PATH.CAMP_ONE}/communications/download`,
};

/** Movement One sub-routes */
export const MOVEMENT_PATH = {
  ROOT: MODULE_PATH.MOVEMENT_ONE,
  INWARD: `${MODULE_PATH.MOVEMENT_ONE}/inward`,
  OUTWARD: `${MODULE_PATH.MOVEMENT_ONE}/outward`,
  USAGE: `${MODULE_PATH.MOVEMENT_ONE}/usage`,
  OUTPUT: `${MODULE_PATH.MOVEMENT_ONE}/output`,
};

export function assetOneDetailPath(id) {
  return `${MODULE_PATH.ASSET_ONE}/assets/${id}`;
}

export function documentOneDetailPath(id) {
  return `${MODULE_PATH.DOCUMENT_ONE}/${id}`;
}

export function documentOneNewPath() {
  return `${MODULE_PATH.DOCUMENT_ONE}/new`;
}

export function campManageEditPath(id) {
  return `${CAMP_PATH.MANAGE}/${id}/edit`;
}

export function financeVendorBillPath(id) {
  return id ? `${FINANCE_PATH.VENDOR_BILLS}/${id}` : FINANCE_PATH.VENDOR_BILLS;
}

export function financeBillingDocPath(slug, id) {
  const base = `${FINANCE_PATH.BILLING}/${slug}`;
  return id ? `${base}/${id}` : base;
}

/**
 * Ordered longest-first rewrites from legacy paths → Module One paths.
 * Used by redirects in App.jsx; prefer MODULE_PATH / FINANCE_PATH in new code.
 */
export const LEGACY_PATH_REDIRECTS = [
  // Finance (longest first)
  ['/finance/build/invoice', FINANCE_PATH.INVOICE],
  ['/finance/build/proforma', FINANCE_PATH.PROFORMA],
  ['/finance/build/purchase-order', FINANCE_PATH.PURCHASE_ORDER],
  ['/finance/build/credit-note', FINANCE_PATH.CREDIT_NOTE],
  ['/finance/build', FINANCE_PATH.BILLING],
  ['/finance/generate-invoice', FINANCE_PATH.INVOICE],
  ['/finance/generate', FINANCE_PATH.BILLING],
  ['/finance/camp-payouts', FINANCE_PATH.PAYOUTS],
  ['/finance/payouts', FINANCE_PATH.PAYOUTS],
  ['/finance/vendor-bills', FINANCE_PATH.VENDOR_BILLS],
  ['/finance/master', FINANCE_PATH.ORGANISATION],
  ['/finance/expenses', FINANCE_PATH.BILLING],
  ['/finance/invoices', FINANCE_PATH.VENDOR_BILLS],
  ['/finance/proforma', FINANCE_PATH.BILLING],
  ['/finance/purchase-orders', FINANCE_PATH.BILLING],
  ['/finance', MODULE_PATH.FINANCE_ONE],

  // Camp
  ['/camps/communications/whatsapp', CAMP_PATH.PASTE],
  ['/camps/communications/upload', CAMP_PATH.UPLOAD],
  ['/camps/communications/download', CAMP_PATH.DOWNLOAD],
  ['/camps/communications/email', CAMP_PATH.EMAIL],
  ['/camps/communications/paste', CAMP_PATH.PASTE],
  ['/camps/communications', CAMP_PATH.COMMUNICATIONS],
  ['/camps/manage', CAMP_PATH.MANAGE],
  ['/camps/import', CAMP_PATH.UPLOAD],
  ['/camps/chargesheet', CAMP_PATH.MANAGE],
  ['/camps/payout', FINANCE_PATH.PAYOUTS],
  ['/camps/users', MODULE_PATH.ACCESS_CONTROL],
  ['/camps', MODULE_PATH.CAMP_ONE],

  // Master
  ['/master-data', MODULE_PATH.MASTER_ONE],

  // Asset
  ['/asset-inventory', MODULE_PATH.ASSET_ONE],
  ['/assets/asset-master', MODULE_PATH.ASSET_ONE],
  ['/assets/product-master', `${MODULE_PATH.MASTER_ONE}?scope=inventory&entity=products`],
  ['/devices', MODULE_PATH.ASSET_ONE],

  // Request (note: /movements was Request One, not Movement One)
  ['/asset-requests', MODULE_PATH.REQUEST_ONE],
  ['/repairs', MODULE_PATH.REQUEST_ONE],
  ['/movements', MODULE_PATH.REQUEST_ONE],

  // Document
  ['/agreements/role-permission-master', MODULE_PATH.ACCESS_CONTROL],
  ['/agreements/contacts', `${MODULE_PATH.MASTER_ONE}?scope=document&entity=contacts`],
  ['/agreements/location-master', `${MODULE_PATH.MASTER_ONE}?scope=camp&entity=pin-codes`],
  ['/agreements/document-master', `${MODULE_PATH.MASTER_ONE}?scope=document&entity=templates`],
  ['/agreements/signature-master', `${MODULE_PATH.MASTER_ONE}?scope=document&entity=signatures`],
  ['/agreements/new', `${MODULE_PATH.DOCUMENT_ONE}/new`],
  ['/agreements', MODULE_PATH.DOCUMENT_ONE],

  // Verification / access / misc
  ['/verifications', MODULE_PATH.VERIFICATION_ONE],
  ['/role-permission-master', MODULE_PATH.ACCESS_CONTROL],
  ['/users', MODULE_PATH.ACCESS_CONTROL],
  ['/hcws', `${MODULE_PATH.MASTER_ONE}?scope=document&entity=contacts`],
  ['/locations', `${MODULE_PATH.MASTER_ONE}?scope=camp&entity=pin-codes`],

  // Logistics → Movement One
  ['/logistics/in-out', MOVEMENT_PATH.INWARD],
  ['/logistics/inward', MOVEMENT_PATH.INWARD],
  ['/logistics/outward', MOVEMENT_PATH.OUTWARD],
  ['/logistics/usage', MOVEMENT_PATH.USAGE],
  ['/logistics/output', MOVEMENT_PATH.OUTPUT],
  ['/logistics/balance', MODULE_PATH.ASSET_ONE],
  ['/logistics/master', `${MODULE_PATH.MASTER_ONE}?scope=movement`],
  ['/logistics', MODULE_PATH.MOVEMENT_ONE],
];
