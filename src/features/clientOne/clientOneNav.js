/** Client One portal navigation — primary client-facing sections. */
export const CLIENT_ONE_NAV = [
  { id: 'dashboard', label: 'Overview', feature: 'dashboard' },
  { id: 'tracker', label: 'Camp Register', feature: 'campTracker' },
  { id: 'invoices', label: 'Incoming Docs', feature: 'invoices' },
  { id: 'mis', label: 'Reports & Analytics', feature: 'mis' },
  { id: 'request-link', label: 'User Base', feature: 'campRequestLink' },
  { id: 'purchase-orders', label: 'Outgoing Docs', feature: 'poUpload' },
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
