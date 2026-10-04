import { describe, expect, it } from 'vitest';
import { buildGpsSelfieWatermarkLines } from './prepareGpsSelfieForUpload.js';

describe('buildGpsSelfieWatermarkLines', () => {
  it('includes camp id, lat/lng, and a date line', () => {
    const lines = buildGpsSelfieWatermarkLines({
      campId: '26-08-0028',
      latitude: 19.07609,
      longitude: 72.877655,
      capturedAt: new Date('2026-10-05T03:30:12'),
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Camp: 26-08-0028');
    expect(lines[1]).toContain('Lat: 19.076090');
    expect(lines[1]).toContain('Lng: 72.877655');
    expect(lines[2]).toMatch(/2026/);
  });

  it('falls back when camp id or coords are missing', () => {
    const lines = buildGpsSelfieWatermarkLines({});
    expect(lines[0]).toBe('Camp: Camp ID unavailable');
    expect(lines[1]).toBe('Lat: —  Lng: —');
    expect(lines[2]).toBeTruthy();
  });
});
