import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  orgBrandCssVars,
  resolveOrgBrandColors,
  sanitizeBrandColor,
} from './orgBrandColors.js';

describe('org brand colours', () => {
  it('normalizes 6-digit hex and rejects junk', () => {
    expect(sanitizeBrandColor('#203e64')).toBe('#203E64');
    expect(sanitizeBrandColor('E7EDF4')).toBe('#E7EDF4');
    expect(sanitizeBrandColor('red')).toBeNull();
    expect(sanitizeBrandColor('#fff')).toBeNull();
  });

  it('falls back to Tylo Care defaults when unset', () => {
    expect(resolveOrgBrandColors({})).toEqual({
      primary: DEFAULT_PRIMARY_COLOR,
      secondary: DEFAULT_SECONDARY_COLOR,
    });
  });

  it('exposes CSS variables for generated documents', () => {
    const vars = orgBrandCssVars({ primaryColor: '#112233', secondaryColor: '#abcdef' });
    expect(vars['--ti-accent']).toBe('#112233');
    expect(vars['--ti-accent-light']).toBe('#ABCDEF');
    expect(vars['--po-accent']).toBe('#112233');
    expect(vars['--dc-accent-light']).toBe('#ABCDEF');
  });
});
