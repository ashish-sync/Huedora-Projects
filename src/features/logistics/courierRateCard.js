/**
 * Air courier rate cards — origin Mumbai, Maharashtra.
 *
 * Billable weight is always in **kg** (higher of actual / volumetric from Book POD).
 *
 * ≤ 5 kg:  first 500 g at base, then every additional 500 g (rounded up).
 * > 5 kg (DTDC only): cost of 5 kg (500 g slabs) + each extra kg (rounded up)
 *                      at the “Additional/kg >5 kg” column — not the 500 g rate.
 */

export const COURIER_ORIGIN = {
  city: 'Mumbai',
  state: 'Maharashtra',
};

const METRO_CITIES = new Set(
  [
    'delhi',
    'new delhi',
    'noida',
    'gurgaon',
    'gurugram',
    'ghaziabad',
    'faridabad',
    'kolkata',
    'calcutta',
    'chennai',
    'madras',
    'bengaluru',
    'bangalore',
    'hyderabad',
    'ahmedabad',
    'pune',
    'jaipur',
    'chandigarh',
    'lucknow',
  ].map((s) => s.toLowerCase())
);

const MUMBAI_CITY_ALIASES = new Set(
  [
    'mumbai',
    'bombay',
    'navi mumbai',
    'thane',
    'kalyan',
    'vasai',
    'virar',
    'mira road',
    'bhiwandi',
  ].map((s) => s.toLowerCase())
);

const DTDC_WITHIN_ZONE_STATES = new Set(
  [
    'gujarat',
    'goa',
    'madhya pradesh',
    'rajasthan',
    'dadra and nagar haveli',
    'dadra & nagar haveli',
    'daman and diu',
    'daman & diu',
    'chhattisgarh',
  ].map((s) => s.toLowerCase())
);

const SPECIAL_STATES = new Set(
  [
    'kerala',
    'jammu and kashmir',
    'jammu & kashmir',
    'j&k',
    'ladakh',
    'assam',
    'arunachal pradesh',
    'manipur',
    'meghalaya',
    'mizoram',
    'nagaland',
    'tripura',
    'sikkim',
  ].map((s) => s.toLowerCase())
);

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Parse billable weight in kg (accepts "1,5" / "1.5 kg"). */
export function parseBillableWeightKg(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/\s*kg\s*$/i, '')
    .replace(/\s*kgs\s*$/i, '')
    .trim();
  const w = Number(cleaned);
  if (!Number.isFinite(w) || w <= 0) return null;
  return w;
}

/**
 * Delhivery / Blue Dart zones (5).
 * @returns {'intra_city'|'intra_state'|'metro'|'rest'|'special'}
 */
export function resolveShipdelightZone(city, state) {
  const c = norm(city);
  const s = norm(state);
  if (SPECIAL_STATES.has(s) || s.includes('kerala') || s.includes('jammu')) return 'special';
  if (MUMBAI_CITY_ALIASES.has(c) || (c.includes('mumbai') && s.includes('maharashtra'))) {
    return 'intra_city';
  }
  if (s === 'maharashtra' || s === 'mh') return 'intra_state';
  if (METRO_CITIES.has(c)) return 'metro';
  return 'rest';
}

/**
 * DTDC zones (6) — includes Within Zone.
 * @returns {'intra_city'|'within_state'|'within_zone'|'metro'|'rest'|'special'}
 */
export function resolveDtdcZone(city, state) {
  const c = norm(city);
  const s = norm(state);
  if (SPECIAL_STATES.has(s) || s.includes('kerala') || s.includes('jammu')) return 'special';
  if (MUMBAI_CITY_ALIASES.has(c) || (c.includes('mumbai') && s.includes('maharashtra'))) {
    return 'intra_city';
  }
  if (s === 'maharashtra' || s === 'mh') return 'within_state';
  if (METRO_CITIES.has(c)) return 'metro';
  if (DTDC_WITHIN_ZONE_STATES.has(s)) return 'within_zone';
  return 'rest';
}

export const ZONE_LABELS = {
  intra_city: 'Intra City',
  intra_state: 'Intra State',
  within_state: 'Within State',
  within_zone: 'Within Zone',
  metro: 'Metros to Metros',
  rest: 'Rest of India',
  special: 'North East / J&K / Kerala',
};

/** Rate-card destination category labels (shown as “Category” in Book POD). */
export const CATEGORY_LABELS = ZONE_LABELS;

/**
 * Charge from billable weight (kg) + rate row.
 * DTDC rows include addlPerKgOver5 for weight above 5 kg.
 *
 * @returns {{ estimate: number, chargeableKg: number, breakdown: string } | null}
 */
export function chargeAirFromBillableKg(weightKg, rates) {
  const w = parseBillableWeightKg(weightKg);
  const base = Number(rates?.base500);
  const addl500 = Number(rates?.addl500);
  if (w == null || !Number.isFinite(base) || base < 0) return null;
  if (!Number.isFinite(addl500) || addl500 < 0) return null;

  const over5Raw = rates?.addlPerKgOver5;
  const over5 =
    over5Raw != null && over5Raw !== '' && Number.isFinite(Number(over5Raw))
      ? Number(over5Raw)
      : null;

  // Work in grams to avoid float edge cases around the 5 kg boundary
  const billableGrams = Math.ceil(w * 1000 - 1e-6);

  if (over5 != null && billableGrams > 5000) {
    // 5 kg at 500 g slabs: 1×base + 9×addl500
    const costFirst5Kg = base + 9 * addl500;
    const extraGrams = billableGrams - 5000;
    const extraKg = Math.ceil(extraGrams / 1000 - 1e-9);
    const estimate = roundMoney(costFirst5Kg + extraKg * over5);
    const chargeableKg = 5 + extraKg;
    return {
      estimate,
      chargeableKg,
      breakdown: `5 kg ₹${costFirst5Kg} + ${extraKg} kg × ₹${over5}`,
      mode: 'dtdc_over_5',
    };
  }

  // ≤ 5 kg (or carriers with no >5 kg column): 500 g slabs on billable weight
  const chargeableGrams = Math.ceil(billableGrams / 500) * 500;
  const slabs = Math.max(1, chargeableGrams / 500);
  const estimate = roundMoney(base + (slabs - 1) * addl500);
  return {
    estimate,
    chargeableKg: chargeableGrams / 1000,
    breakdown:
      slabs === 1
        ? `Up to 500 g ₹${base}`
        : `500 g ₹${base} + ${slabs - 1} × ₹${addl500}`,
    mode: 'slab_500',
  };
}

/** @deprecated Use chargeAirFromBillableKg — kept for callers expecting a number */
export function chargeAir500gSlab(weightKg, rates) {
  const result = chargeAirFromBillableKg(weightKg, rates);
  return result ? result.estimate : null;
}

const DTDC_PREMIUM_AIR = {
  id: 'dtdc-premium_air',
  name: 'DTDC Premium',
  courier: 'DTDC',
  serviceType: 'PREMIUM',
  mode: 'air',
  zoneResolver: resolveDtdcZone,
  rates: {
    intra_city: { base500: 45, addl500: 31, addlPerKgOver5: 51 },
    within_state: { base500: 66, addl500: 40, addlPerKgOver5: 66 },
    within_zone: { base500: 71, addl500: 51, addlPerKgOver5: 91 },
    metro: { base500: 121, addl500: 104, addlPerKgOver5: 193 },
    rest: { base500: 130, addl500: 110, addlPerKgOver5: 204 },
    special: { base500: 154, addl500: 136, addlPerKgOver5: 245 },
  },
};

const DTDC_PRIORITY_AIR = {
  id: 'dtdc-priority_air',
  name: 'DTDC Priority',
  courier: 'DTDC',
  serviceType: 'PRIORITY',
  mode: 'air',
  zoneResolver: resolveDtdcZone,
  rates: {
    intra_city: { base500: 27, addl500: 18, addlPerKgOver5: 31 },
    within_state: { base500: 38, addl500: 24, addlPerKgOver5: 39 },
    within_zone: { base500: 42, addl500: 30, addlPerKgOver5: 55 },
    metro: { base500: 56, addl500: 51, addlPerKgOver5: 94 },
    rest: { base500: 62, addl500: 54, addlPerKgOver5: 102 },
    special: { base500: 89, addl500: 77, addlPerKgOver5: 143 },
  },
};

const DELHIVERY_AIR = {
  id: 'delhivery-air',
  name: 'Delhivery',
  courier: 'Delhivery',
  serviceType: '',
  mode: 'air',
  zoneResolver: resolveShipdelightZone,
  rates: {
    intra_city: { base500: 44, addl500: 40 },
    intra_state: { base500: 46, addl500: 43 },
    metro: { base500: 61, addl500: 56 },
    rest: { base500: 68, addl500: 62 },
    special: { base500: 84, addl500: 80 },
  },
};

const BLUE_DART_AIR = {
  id: 'bluedart-air',
  name: 'Blue Dart',
  courier: 'Blue Dart',
  serviceType: '',
  mode: 'air',
  zoneResolver: resolveShipdelightZone,
  rates: {
    intra_city: { base500: 58, addl500: 58 },
    intra_state: { base500: 64, addl500: 64 },
    metro: { base500: 68, addl500: 68 },
    rest: { base500: 90, addl500: 90 },
    special: { base500: 100, addl500: 100 },
  },
};

export const AIR_COURIER_SERVICES = [
  DTDC_PRIORITY_AIR,
  DTDC_PREMIUM_AIR,
  DELHIVERY_AIR,
  BLUE_DART_AIR,
];

/**
 * Quote all Air services from billable weight (kg) + destination.
 */
export function quoteCourierRateCard(weightKg, dest = {}) {
  const city = dest.city || '';
  const state = dest.state || '';
  const billableKg = parseBillableWeightKg(weightKg);

  const options = AIR_COURIER_SERVICES.map((svc) => {
    const zone = svc.zoneResolver(city, state);
    const rate = svc.rates[zone];
    const priced = rate && billableKg != null ? chargeAirFromBillableKg(billableKg, rate) : null;
    return {
      id: `ratecard-${svc.id}`,
      name: svc.name,
      courier: svc.courier || svc.name,
      serviceType: svc.serviceType || '',
      mode: svc.mode || 'air',
      serviceId: svc.id,
      zone,
      zoneLabel: CATEGORY_LABELS[zone] || ZONE_LABELS[zone] || zone,
      categoryLabel: CATEGORY_LABELS[zone] || ZONE_LABELS[zone] || zone,
      base500: rate?.base500 ?? null,
      addl500: rate?.addl500 ?? null,
      addlPerKgOver5: rate?.addlPerKgOver5 ?? null,
      billableKg,
      chargeableKg: priced?.chargeableKg ?? null,
      breakdown: priced?.breakdown || '',
      estimate: priced?.estimate ?? null,
      chargeMode: priced?.mode || '',
      source: 'ratecard',
    };
  });

  const priced = options.filter((o) => o.estimate != null);
  const cheapest = priced.length ? Math.min(...priced.map((o) => o.estimate)) : null;
  return options
    .map((o) => ({
      ...o,
      isCheapest: o.estimate != null && o.estimate === cheapest,
    }))
    .sort((a, b) => {
      if (a.estimate == null && b.estimate == null) return a.name.localeCompare(b.name);
      if (a.estimate == null) return 1;
      if (b.estimate == null) return -1;
      return a.estimate - b.estimate;
    });
}

export function cheapestCourierQuote(weightKg, dest) {
  const list = quoteCourierRateCard(weightKg, dest);
  return list.find((o) => o.isCheapest) || list[0] || null;
}
