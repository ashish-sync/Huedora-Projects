import { describe, expect, it } from 'vitest';
import { resolvePunctuality } from '../constants/campLifecycle.js';

describe('resolvePunctuality', () => {
  it('marks on-time and early arrivals as Good', () => {
    expect(resolvePunctuality('09:00', '08:50')).toBe('Good');
    expect(resolvePunctuality('09:00', '09:00')).toBe('Good');
    expect(resolvePunctuality('09:00', '09:05')).toBe('Good');
  });

  it('marks 5–15 minutes late as Average', () => {
    expect(resolvePunctuality('09:00', '09:06')).toBe('Average');
    expect(resolvePunctuality('09:00', '09:15')).toBe('Average');
  });

  it('marks more than 15 minutes late as Poor', () => {
    expect(resolvePunctuality('09:00', '09:16')).toBe('Poor');
    expect(resolvePunctuality('09:00', '10:00')).toBe('Poor');
  });

  it('returns empty when times are missing', () => {
    expect(resolvePunctuality('09:00', '')).toBe('');
    expect(resolvePunctuality('', '09:10')).toBe('');
  });
});
