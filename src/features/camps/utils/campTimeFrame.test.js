import { describe, expect, it } from 'vitest';
import { getCampTimeFrameDisplay } from './campTimeFrame.js';
import { resolveCampSlot } from '../constants/campLifecycle.js';

describe('getCampTimeFrameDisplay', () => {
  it('derives Morning from startTime when campSlot is blank', () => {
    const data = getCampTimeFrameDisplay({
      camp: { startTime: '10:00', endTime: '14:00', durationHours: 4, campSlot: '' },
    });
    expect(data.slot).toBe('Morning');
    expect(data.timeRange).toBe('10:00 – 14:00');
  });

  it('derives Morning for 10:30 even when stored campSlot is dash junk', () => {
    const data = getCampTimeFrameDisplay({
      camp: {
        startTime: '10:30',
        endTime: '14:30',
        durationHours: 4,
        campSlot: '—',
      },
    });
    expect(data.slot).toBe('Morning');
  });

  it('derives Noon from afternoon start when campSlot missing', () => {
    const data = getCampTimeFrameDisplay({
      camp: { startTime: '14:00', endTime: '18:00', durationHours: 4 },
    });
    expect(data.slot).toBe('Noon');
  });

  it('derives Evening from evening start', () => {
    const data = getCampTimeFrameDisplay({
      camp: { startTime: '17:30', endTime: '21:30', durationHours: 4 },
    });
    expect(data.slot).toBe('Evening');
  });

  it('prefers start-time derivation over a stale stored slot', () => {
    const data = getCampTimeFrameDisplay({
      camp: { startTime: '14:00', endTime: '18:00', campSlot: 'Morning' },
    });
    expect(data.slot).toBe('Noon');
  });

  it('keeps stored campSlot only when startTime cannot be parsed', () => {
    const data = getCampTimeFrameDisplay({
      camp: { startTime: '', endTime: '', campSlot: 'Morning' },
    });
    expect(data.slot).toBe('Morning');
  });
});

describe('resolveCampSlot', () => {
  it('maps morning / noon / evening windows', () => {
    expect(resolveCampSlot('06:00')).toBe('Morning');
    expect(resolveCampSlot('10:00')).toBe('Morning');
    expect(resolveCampSlot('10:30')).toBe('Morning');
    expect(resolveCampSlot('12:59')).toBe('Morning');
    expect(resolveCampSlot('13:00')).toBe('Noon');
    expect(resolveCampSlot('16:59')).toBe('Noon');
    expect(resolveCampSlot('17:00')).toBe('Evening');
    expect(resolveCampSlot('21:00')).toBe('Evening');
  });

  it('parses AM/PM and dotted formats', () => {
    expect(resolveCampSlot('10:00 AM')).toBe('Morning');
    expect(resolveCampSlot('10.30')).toBe('Morning');
    expect(resolveCampSlot('2:00 PM')).toBe('Noon');
    expect(resolveCampSlot('5:30 pm')).toBe('Evening');
  });
});
