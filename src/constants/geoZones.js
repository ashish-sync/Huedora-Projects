/** Client mirror of server camp zone definitions for instant state → zone lookup. */
export const CAMP_ZONE_DEFINITIONS = [
  {
    code: 'north',
    name: 'North Zone',
    states: [
      'Chandigarh',
      'Delhi',
      'Haryana',
      'Himachal Pradesh',
      'Jammu and Kashmir',
      'Ladakh',
      'Punjab',
      'Rajasthan',
      'Uttarakhand',
    ],
  },
  {
    code: 'south',
    name: 'South Zone',
    states: [
      'Andhra Pradesh',
      'Karnataka',
      'Kerala',
      'Tamil Nadu',
      'Telangana',
      'Puducherry',
      'Lakshadweep',
    ],
  },
  {
    code: 'east',
    name: 'East Zone',
    states: ['Bihar', 'Jharkhand', 'Odisha', 'West Bengal'],
  },
  {
    code: 'west',
    name: 'West Zone',
    states: ['Goa', 'Gujarat', 'Maharashtra', 'Dadra and Nagar Haveli and Daman and Diu'],
  },
  {
    code: 'central',
    name: 'Central Zone',
    states: ['Chhattisgarh', 'Madhya Pradesh', 'Uttar Pradesh'],
  },
  {
    code: 'north-east',
    name: 'North-East Zone',
    states: [
      'Arunachal Pradesh',
      'Assam',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Sikkim',
      'Tripura',
    ],
  },
];

const STATE_NAME_ALIASES = {
  'delhi (nct)': 'Delhi',
  'nct of delhi': 'Delhi',
  'jammu & kashmir': 'Jammu and Kashmir',
  'dadra & nagar haveli and daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  uttaranchal: 'Uttarakhand',
};

function normKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function canonicalStateName(stateName) {
  const raw = String(stateName ?? '').trim();
  if (!raw) return '';
  const key = normKey(raw);
  return STATE_NAME_ALIASES[key] || raw;
}

const stateZoneLookup = new Map();
for (const zone of CAMP_ZONE_DEFINITIONS) {
  for (const stateName of zone.states) {
    stateZoneLookup.set(normKey(stateName), zone.name);
  }
}

export function resolveZoneForState(stateName) {
  const canonical = canonicalStateName(stateName);
  if (!canonical) return '';
  return stateZoneLookup.get(normKey(canonical)) || '';
}

export const CAMP_ZONE_NAMES = CAMP_ZONE_DEFINITIONS.map((z) => z.name);
