/** Client One portal navigation — primary client-facing sections. */
export const CLIENT_ONE_NAV = [
  { id: 'dashboard', label: 'Dashboard', feature: 'dashboard' },
  { id: 'tracker', label: 'Camp Tracker', feature: 'campTracker' },
  { id: 'invoices', label: 'Bills & Invoices', feature: 'invoices' },
  { id: 'mis', label: 'MIS Reports', feature: 'mis' },
  { id: 'request-link', label: 'Camp Request', feature: 'campRequestLink' },
  { id: 'purchase-orders', label: 'Purchase Orders', feature: 'poUpload' },
];

export const DEFAULT_FEATURES = Object.freeze({
  dashboard: true,
  campTracker: true,
  hcw: false,
  calendar: false,
  invoices: true,
  annexures: false,
  mis: true,
  campRequestLink: true,
  poUpload: true,
});

export function visibleNav(features = DEFAULT_FEATURES) {
  return CLIENT_ONE_NAV.filter((item) => features?.[item.feature] !== false);
}
