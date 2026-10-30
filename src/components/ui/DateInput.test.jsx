import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateInput } from './DateInput.jsx';

describe('DateInput calendar', () => {
  afterEach(() => cleanup());

  it('exposes a tappable native date input over the calendar icon', () => {
    render(<DateInput label="Camp Date" value="" onChange={vi.fn()} />);

    const picker = screen.getByLabelText('Open calendar for Camp Date');
    expect(picker).toBeTruthy();
    expect(picker.getAttribute('type')).toBe('date');
    expect(picker.getAttribute('aria-hidden')).toBeNull();
    expect(picker.className).toContain('date-input-native');
  });

  it('commits the native date value', () => {
    const onChange = vi.fn();
    render(<DateInput label="Camp Date" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Open calendar for Camp Date'), {
      target: { value: '2026-11-02' },
    });
    expect(onChange).toHaveBeenCalledWith('2026-11-02');
  });

  it('keeps hideLabel aria-label unique from the calendar overlay', () => {
    render(
      <DateInput hideLabel aria-label="From date" placeholder="From" value="" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('From date')).toBeTruthy();
    expect(screen.getByLabelText('Open calendar for From date')).toBeTruthy();
    expect(screen.getByPlaceholderText('From')).toBeTruthy();
  });
});
