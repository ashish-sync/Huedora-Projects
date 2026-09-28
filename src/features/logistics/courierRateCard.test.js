import { describe, it, expect } from 'vitest';
import {
  quoteCourierRateCard,
  resolveShipdelightZone,
  resolveDtdcZone,
  chargeAir500gSlab,
  chargeAirFromBillableKg,
  parseBillableWeightKg,
} from './courierRateCard.js';

describe('courierRateCard', () => {
  it('parses billable weight', () => {
    expect(parseBillableWeightKg('1,5')).toBe(1.5);
    expect(parseBillableWeightKg('2 kg')).toBe(2);
  });

  it('resolves Shipdelight / Delhivery zones', () => {
    expect(resolveShipdelightZone('Mumbai', 'Maharashtra')).toBe('intra_city');
    expect(resolveShipdelightZone('Pune', 'Maharashtra')).toBe('intra_state');
    expect(resolveShipdelightZone('Bengaluru', 'Karnataka')).toBe('metro');
    expect(resolveShipdelightZone('Kochi', 'Kerala')).toBe('special');
  });

  it('resolves DTDC zones', () => {
    expect(resolveDtdcZone('Ahmedabad', 'Gujarat')).toBe('metro');
    expect(resolveDtdcZone('Surat', 'Gujarat')).toBe('within_zone');
    expect(resolveDtdcZone('Pune', 'Maharashtra')).toBe('within_state');
    expect(resolveDtdcZone('Indore', 'Madhya Pradesh')).toBe('within_zone');
  });

  it('charges ≤5 kg on 500 g slabs', () => {
    const priIntra = { base500: 27, addl500: 18, addlPerKgOver5: 31 };
    expect(chargeAir500gSlab(0.5, priIntra)).toBe(27);
    expect(chargeAir500gSlab(1, priIntra)).toBe(45);
    expect(chargeAir500gSlab(1.1, priIntra)).toBe(63);
    expect(chargeAir500gSlab(5, priIntra)).toBe(27 + 9 * 18);
  });

  it('charges DTDC >5 kg with per-kg column', () => {
    const priIntra = { base500: 27, addl500: 18, addlPerKgOver5: 31 };
    const premIntra = { base500: 45, addl500: 31, addlPerKgOver5: 51 };

    expect(chargeAir500gSlab(5.1, priIntra)).toBe(27 + 9 * 18 + 31);
    expect(chargeAir500gSlab(6, priIntra)).toBe(27 + 9 * 18 + 31);
    expect(chargeAir500gSlab(6.5, priIntra)).toBe(27 + 9 * 18 + 2 * 31);
    expect(chargeAir500gSlab(6, premIntra)).toBe(45 + 9 * 31 + 51);
    expect(chargeAir500gSlab(6, priIntra)).not.toBe(27 + 11 * 18);

    const over = chargeAirFromBillableKg(6.5, priIntra);
    expect(over?.mode).toBe('dtdc_over_5');
    expect(over?.chargeableKg).toBe(7);
  });

  it('quotes Mumbai Intra City air services', () => {
    const mum = quoteCourierRateCard(0.5, { city: 'Mumbai', state: 'Maharashtra' });
    expect(mum.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate).toBe(27);
    expect(mum.find((o) => o.id === 'ratecard-dtdc-premium_air')?.estimate).toBe(45);
    expect(mum.find((o) => o.id === 'ratecard-delhivery-air')?.estimate).toBe(44);
    expect(mum.find((o) => o.id === 'ratecard-bluedart-air')?.estimate).toBe(58);

    const mum6 = quoteCourierRateCard(6, { city: 'Mumbai', state: 'Maharashtra' });
    expect(mum6.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate).toBe(220);
    expect(mum6.find((o) => o.id === 'ratecard-dtdc-premium_air')?.estimate).toBe(375);
    expect(mum6.find((o) => o.id === 'ratecard-delhivery-air')?.estimate).toBe(484);
  });

  it('quotes DTDC within_zone for Indore', () => {
    const indore = quoteCourierRateCard(1, { city: 'Indore', state: 'Madhya Pradesh' });
    expect(indore.find((o) => o.id === 'ratecard-dtdc-priority_air')?.estimate).toBe(72);
  });
});
