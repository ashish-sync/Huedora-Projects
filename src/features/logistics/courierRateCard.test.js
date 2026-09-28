/**
 * Sanity checks for Air rate cards (origin Mumbai) — billable kg + DTDC >5 kg.
 * Run: node courierRateCard.test.js
 */
import {
  quoteCourierRateCard,
  resolveShipdelightZone,
  resolveDtdcZone,
  chargeAir500gSlab,
  chargeAirFromBillableKg,
  parseBillableWeightKg,
} from './courierRateCard.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(parseBillableWeightKg('1,5') === 1.5, 'comma decimal');
assert(parseBillableWeightKg('2 kg') === 2, 'kg suffix');

assert(resolveShipdelightZone('Mumbai', 'Maharashtra') === 'intra_city', 'mumbai zone');
assert(resolveShipdelightZone('Pune', 'Maharashtra') === 'intra_state', 'pune zone');
assert(resolveShipdelightZone('Bengaluru', 'Karnataka') === 'metro', 'blr zone');
assert(resolveShipdelightZone('Kochi', 'Kerala') === 'special', 'kerala zone');
assert(resolveDtdcZone('Ahmedabad', 'Gujarat') === 'metro', 'ahmedabad metro before zone');
assert(resolveDtdcZone('Surat', 'Gujarat') === 'within_zone', 'surat dtdc within_zone');
assert(resolveDtdcZone('Pune', 'Maharashtra') === 'within_state', 'dtdc pune');
assert(resolveDtdcZone('Indore', 'Madhya Pradesh') === 'within_zone', 'indore dtdc');

const priIntra = { base500: 27, addl500: 18, addlPerKgOver5: 31 };
const premIntra = { base500: 45, addl500: 31, addlPerKgOver5: 51 };

assert(chargeAir500gSlab(0.5, priIntra) === 27, 'base only');
assert(chargeAir500gSlab(1, priIntra) === 45, '1kg = base+addl');
assert(chargeAir500gSlab(1.1, priIntra) === 63, '1.1 rounds to 3 slabs');
assert(chargeAir500gSlab(5, priIntra) === 27 + 9 * 18, 'exactly 5kg still 500g slabs');

// DTDC >5 kg: 5kg slab cost + ceil(extra) × per-kg column (NOT more 500g slabs)
assert(
  chargeAir500gSlab(5.1, priIntra) === 27 + 9 * 18 + 31,
  `priority 5.1 got ${chargeAir500gSlab(5.1, priIntra)}`
);
assert(
  chargeAir500gSlab(6, priIntra) === 27 + 9 * 18 + 31,
  `priority 6kg got ${chargeAir500gSlab(6, priIntra)}`
);
assert(
  chargeAir500gSlab(6.5, priIntra) === 27 + 9 * 18 + 2 * 31,
  `priority 6.5 got ${chargeAir500gSlab(6.5, priIntra)}`
);
assert(
  chargeAir500gSlab(6, premIntra) === 45 + 9 * 31 + 51,
  `premium 6kg got ${chargeAir500gSlab(6, premIntra)}`
);
// Must NOT keep using ₹18 / 500g above 5kg (that would be 27+11*18=225)
assert(chargeAir500gSlab(6, priIntra) !== 27 + 11 * 18, 'must not use 500g rate above 5kg');

const over = chargeAirFromBillableKg(6.5, priIntra);
assert(over?.mode === 'dtdc_over_5', 'mode over 5');
assert(over?.chargeableKg === 7, `chargeable 7 got ${over?.chargeableKg}`);

// Mumbai Intra City quotes
const mum = quoteCourierRateCard(0.5, { city: 'Mumbai', state: 'Maharashtra' });
assert(mum.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate === 27, 'pri 0.5');
assert(mum.find((o) => o.id === 'ratecard-dtdc-premium_air')?.estimate === 45, 'prem 0.5');
assert(mum.find((o) => o.id === 'ratecard-delhivery-air')?.estimate === 44, 'del 0.5');
assert(mum.find((o) => o.id === 'ratecard-bluedart-air')?.estimate === 58, 'bd 0.5');

const mum6 = quoteCourierRateCard(6, { city: 'Mumbai', state: 'Maharashtra' });
assert(
  mum6.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate === 220,
  `pri 6kg quote got ${mum6.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate}`
);
assert(
  mum6.find((o) => o.id === 'ratecard-dtdc-premium_air')?.estimate === 375,
  `prem 6kg quote got ${mum6.find((o) => o.id === 'ratecard-dtdc-premium_air')?.estimate}`
);
// Delhivery has no >5 column — continues 500g slabs: 44+11*40=484
assert(
  mum6.find((o) => o.id === 'ratecard-delhivery-air')?.estimate === 484,
  `del 6kg got ${mum6.find((o) => o.id === 'ratecard-delhivery-air')?.estimate}`
);

const indore = quoteCourierRateCard(1, { city: 'Indore', state: 'Madhya Pradesh' });
assert(
  indore.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate === 72,
  'priority within_zone 1kg'
);

console.log('courierRateCard.test.js OK');
