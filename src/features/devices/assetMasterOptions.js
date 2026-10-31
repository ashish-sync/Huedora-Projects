export const OWNERSHIP_TYPE_OPTIONS = [
  'Client Owned',
  'Tylo Owned',
  'Rented Asset',
];

const OWNERSHIP_TYPE_ALIASES = {
  owned: 'Tylo Owned',
  'company owned': 'Tylo Owned',
  'company-owned': 'Tylo Owned',
  'tylo owned': 'Tylo Owned',
  rented: 'Rented Asset',
  'rented asset': 'Rented Asset',
  'client owned': 'Client Owned',
  'client-owned': 'Client Owned',
  hybrid: 'Tylo Owned',
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
  'Tylo Office',
  'Lost/Stolen',
  'Agreement Signed',
  'Not Initiated',
  'Under Repairs',
  'Untraceable',
  'End of Life',
];

export const ASSET_CUSTODY_OPTIONS = [
  'Client / Rented',
  'Tylo Office',
  'Individual',
  'Service Provider',
];

export function custodyRequiresCustodianContact(custody) {
  return custody === 'Individual' || custody === 'Service Provider';
}

/**
 * Individual or Service Provider custody can be linked to any Healthcare Worker
 * (Individual, Full-Time, Service Provider, or Other).
 */
export function contactMatchesCustody(contact, custody) {
  if (!custodyRequiresCustodianContact(custody)) return true;
  if (!contact) return false;
  return String(contact.contactCategory || '').trim() === 'Healthcare Worker';
}
