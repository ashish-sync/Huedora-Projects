export const OWNERSHIP_TYPE_OPTIONS = [
  'Company Owned',
  'Rented',
  'Client Owned',
  'Hybrid',
];

const OWNERSHIP_TYPE_ALIASES = {
  owned: 'Company Owned',
  'company owned': 'Company Owned',
  rented: 'Rented',
  'client owned': 'Client Owned',
  hybrid: 'Hybrid',
};

export function formatOwnershipType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const alias = OWNERSHIP_TYPE_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const hit = OWNERSHIP_TYPE_OPTIONS.find((o) => o.toLowerCase() === raw.toLowerCase());
  return hit || raw;
}

export const ASSET_STATUS_OPTIONS = [
  'With TCPL',
  'Not Applicable',
  'Lost/Stolen',
  'Agreement Signed',
  'Not Initiated',
  'Under Repairs',
  'Untraceable',
  'End of Life',
];

export const ASSET_CUSTODY_OPTIONS = [
  'Client / Rented',
  'TCPL - Head Office',
  'TPCL - Warehouse',
  'Individual',
  'Service Provider',
];
