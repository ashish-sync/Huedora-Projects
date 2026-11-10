/** Client One portal navigation — order matches the professional client view. */
export const CLIENT_ONE_NAV = [
  { id: 'dashboard', label: 'Dashboard', feature: 'dashboard' },
  { id: 'tracker', label: 'Camp Tracker', feature: 'campTracker' },
  { id: 'hcw', label: 'HCW Details', feature: 'hcw' },
  { id: 'calendar', label: 'Calendar', feature: 'calendar' },
  { id: 'invoices', label: 'Bills & Invoices', feature: 'invoices' },
  { id: 'annexures', label: 'Annexures', feature: 'annexures' },
  { id: 'mis', label: 'MIS Reports', feature: 'mis' },
  { id: 'request-link', label: 'Camp Request', feature: 'campRequestLink' },
  { id: 'purchase-orders', label: 'Purchase Orders', feature: 'poUpload' },
];

export const DEFAULT_FEATURES = Object.freeze({
  dashboard: true,
  campTracker: true,
  hcw: true,
  calendar: true,
  invoices: true,
  annexures: true,
  mis: true,
  campRequestLink: true,
  poUpload: true,
});

export function visibleNav(features = DEFAULT_FEATURES) {
  return CLIENT_ONE_NAV.filter((item) => features?.[item.feature] !== false);
}
