import { describe, expect, it } from 'vitest';
import {
  TRAVEL_STATUS,
  estimatedTravelStatus,
  extractIndiaPin,
  hasExistingTravelKm,
  hasValidCampCoords,
  resolveHcwTravelPin,
  shouldKeepManualTravel,
  travelEstimateKey,
  usableEstimatedKm,
} from './campTravelEstimate.js';

describe('campTravelEstimate', () => {
  it('reads a 6-digit PIN and ignores invalid values', () => {
    expect(extractIndiaPin('400058')).toBe('400058');
    expect(extractIndiaPin('Home, 400058 Mumbai')).toBe('400058');
    expect(extractIndiaPin('12')).toBe('');
  });

  it('rejects missing or zero camp coordinates', () => {
    expect(hasValidCampCoords({ latitude: '19.12', longitude: '72.84' })).toBe(true);
    expect(hasValidCampCoords({ latitude: '', longitude: '72.84' })).toBe(false);
    expect(hasValidCampCoords({ latitude: 0, longitude: 0 })).toBe(false);
    expect(hasValidCampCoords({ latitude: '' })).toBe(false);
  });

  it('never treats 0 as a usable auto-estimate', () => {
    expect(usableEstimatedKm(0)).toBeNull();
    expect(usableEstimatedKm('0')).toBeNull();
    expect(usableEstimatedKm(24.6)).toBe(24.6);
    expect(hasExistingTravelKm('')).toBe(false);
  });

  it('keeps a manual override and falls back to the provider PIN', () => {
    expect(shouldKeepManualTravel('manual')).toBe(true);
    expect(shouldKeepManualTravel('auto')).toBe(false);
    expect(resolveHcwTravelPin(
      { pinCode: '', serviceProviderContactId: 'sp1' },
      [{ _id: 'sp1', pinCode: '411001' }],
    )).toBe('411001');
  });

  it('builds a stable cache key and status copy', () => {
    expect(travelEstimateKey({ pin: '400058', destLat: 19.11971, destLng: 72.84683 }))
      .toBe('400058|19.1197|72.8468');
    expect(travelEstimateKey({ pin: '400058', destPin: '560001' }))
      .toBe('400058|pin:560001');
    expect(travelEstimateKey({ pin: '400058', destLat: '', destLng: '' })).toBe('');
    expect(estimatedTravelStatus('400058')).toMatch(/400058/);
    expect(TRAVEL_STATUS.PIN_MISSING).toMatch(/PIN code is missing/);
    expect(TRAVEL_STATUS.COORDS_MISSING).toMatch(/coordinates and PIN are missing/);
  });
});
