import { describe, expect, it } from 'vitest';
import {
  TRAVEL_STATUS,
  estimatedTravelStatus,
  extractIndiaPin,
  hasExistingTravelKm,
  hasValidCampCoords,
  resolveHcwOriginCoords,
  resolveHcwTravelPin,
  resolveTravelContact,
  shouldKeepManualTravel,
  shouldPreserveTravelKm,
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

  it('preserves legacy Travelled Kms when source is empty, and still auto-fills new empty camps', () => {
    // Existing record created before kmRoundTripSource existed
    expect(shouldPreserveTravelKm('', 42)).toBe(true);
    expect(shouldPreserveTravelKm(undefined, '18.5')).toBe(true);
    expect(shouldPreserveTravelKm('manual', 12)).toBe(true);
    // New / auto-owned records may re-estimate when the key changes
    expect(shouldPreserveTravelKm('auto', 42)).toBe(false);
    // New camps with no distance yet must still auto-estimate
    expect(shouldPreserveTravelKm('', '')).toBe(false);
    expect(shouldPreserveTravelKm('', 0)).toBe(false);
  });

  it('prefers the full assigned contact over the assign-list row for travel origin', () => {
    const listContact = { _id: 'hcw1', pinCode: '400001' };
    const assigned = {
      _id: 'hcw1',
      pinCode: '400058',
      latitude: '19.12',
      longitude: '72.84',
    };
    const preferred = resolveTravelContact({
      assignedHcwContact: assigned,
      listContact,
      hcwContactId: 'hcw1',
    });
    expect(preferred).toBe(assigned);
    expect(resolveHcwTravelPin(preferred)).toBe('400058');
    expect(resolveHcwOriginCoords(preferred)).toEqual({
      originLat: '19.12',
      originLng: '72.84',
    });
    // Legacy contacts without home-address coords still resolve PIN only
    expect(resolveHcwOriginCoords({ _id: 'hcw2', pinCode: '411001' }))
      .toEqual({ originLat: '', originLng: '' });
    expect(resolveTravelContact({
      assignedHcwContact: null,
      listContact,
      hcwContactId: 'hcw1',
    })).toBe(listContact);
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
