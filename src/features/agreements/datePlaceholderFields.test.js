import { describe, expect, it } from 'vitest';
import { isDatePlaceholder, isTodayDatePlaceholder } from './datePlaceholderFields.js';

describe('datePlaceholderFields', () => {
  it('detects Todays Date and Effective Date labels', () => {
    expect(isDatePlaceholder({ label: 'Todays Date', type: 'text' })).toBe(true);
    expect(isDatePlaceholder({ label: "Today's Date", type: 'text' })).toBe(true);
    expect(isDatePlaceholder({ label: 'Effective Date', key: 'effective_date' })).toBe(true);
    expect(isDatePlaceholder({ type: 'date', label: 'Anything' })).toBe(true);
  });

  it('does not treat Remarks as a date', () => {
    expect(isDatePlaceholder({ label: 'Remarks', type: 'text' })).toBe(false);
    expect(isDatePlaceholder({ label: 'Update', type: 'text' })).toBe(false);
  });

  it('identifies today date fields for defaulting', () => {
    expect(isTodayDatePlaceholder({ label: 'Todays Date' })).toBe(true);
    expect(isTodayDatePlaceholder({ label: 'Effective Date' })).toBe(false);
  });
});
