export const CONTACT_PERSON_LEVELS = [
  'Territory Manager',
  'Area Manager',
  'Regional Manager',
  'Zonal Manager',
  'Product Manager',
];

export const DEFAULT_CONTACT_PERSON_LEVEL = 'Territory Manager';

const LEGACY_CONTACT_PERSON_LEVEL_ALIASES = {
  'TBM/MR': 'Territory Manager',
  TBM: 'Territory Manager',
  MR: 'Territory Manager',
  ABM: 'Area Manager',
  RBM: 'Regional Manager',
  ZBM: 'Zonal Manager',
  PM: 'Product Manager',
};

export const CONTACT_PERSON_LEVEL_OPTIONS = CONTACT_PERSON_LEVELS.map((label) => ({
  value: label,
  label,
}));

const LEVEL_VALUES = new Set(CONTACT_PERSON_LEVELS);

export function normalizeContactPersonLevel(level) {
  const trimmed = String(level ?? '').trim();
  if (!trimmed) return DEFAULT_CONTACT_PERSON_LEVEL;
  if (LEVEL_VALUES.has(trimmed)) return trimmed;
  return LEGACY_CONTACT_PERSON_LEVEL_ALIASES[trimmed]
    || LEGACY_CONTACT_PERSON_LEVEL_ALIASES[trimmed.toUpperCase()]
    || DEFAULT_CONTACT_PERSON_LEVEL;
}

export function emptyContactPerson(level = DEFAULT_CONTACT_PERSON_LEVEL) {
  return {
    level: normalizeContactPersonLevel(level),
    name: '',
    phone: '',
  };
}

export function normalizeContactPersons(source = {}) {
  const list = Array.isArray(source.contactPersons) ? source.contactPersons : [];
  if (list.length) {
    return list.map((item) => ({
      level: normalizeContactPersonLevel(item?.level ?? item?.contactPersonLevel),
      name: String(item?.name ?? item?.fieldPersonName ?? '').trim(),
      phone: String(item?.phone ?? item?.fieldPersonPhone ?? '').trim(),
    }));
  }

  const legacy = emptyContactPerson(source.contactPersonLevel || DEFAULT_CONTACT_PERSON_LEVEL);
  legacy.name = String(source.fieldPersonName || '').trim();
  legacy.phone = String(source.fieldPersonPhone || '').trim();

  if (legacy.name || legacy.phone) {
    return [legacy];
  }

  return [emptyContactPerson()];
}

export function syncPrimaryContactFields(contactPersons) {
  const contacts = normalizeContactPersons({ contactPersons });
  const primary = contacts[0] || emptyContactPerson();
  return {
    contactPersons: contacts,
    contactPersonLevel: primary.level,
    fieldPersonName: primary.name,
    fieldPersonPhone: primary.phone,
  };
}
