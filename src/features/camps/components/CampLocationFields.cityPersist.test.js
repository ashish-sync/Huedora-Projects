import { describe, it, expect } from 'vitest';
import { shouldClearCityOnLocationChange } from './CampLocationFields.jsx';

describe('shouldClearCityOnLocationChange', () => {
  it('does not clear city when PIN re-lookup only fills missing ids', () => {
    expect(shouldClearCityOnLocationChange(
      {
        city: 'Pune',
        cityId: 'c1',
        state: 'Maharashtra',
        district: 'Pune',
        stateId: '',
        districtId: '',
      },
      {
        state: 'Maharashtra',
        district: 'Pune',
        stateId: 's1',
        districtId: 'd1',
      },
    )).toBe(false);
  });

  it('does not clear city when the same ids are re-emitted', () => {
    expect(shouldClearCityOnLocationChange(
      { city: 'Pune', cityId: 'c1', stateId: 's1', districtId: 'd1' },
      { stateId: 's1', districtId: 'd1' },
    )).toBe(false);
  });

  it('clears city when district or state actually changes', () => {
    expect(shouldClearCityOnLocationChange(
      { city: 'Pune', cityId: 'c1', stateId: 's1', districtId: 'd1' },
      { stateId: 's1', districtId: 'd2' },
    )).toBe(true);
    expect(shouldClearCityOnLocationChange(
      { city: 'Pune', cityId: 'c1', stateId: 's1', districtId: 'd1' },
      { stateId: 's2', districtId: 'd9' },
    )).toBe(true);
  });

  it('clears city when location is wiped (PIN cleared)', () => {
    expect(shouldClearCityOnLocationChange(
      { city: 'Pune', cityId: 'c1', stateId: 's1', districtId: 'd1' },
      { stateId: '', districtId: '' },
    )).toBe(true);
  });
});
