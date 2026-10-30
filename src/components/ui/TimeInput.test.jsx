import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TimeInput } from './TimeInput.jsx';

describe('TimeInput', () => {
  afterEach(() => cleanup());

  it('covers the control with a tappable native time input', () => {
    render(<TimeInput label="Start Time" value="09:00" onChange={vi.fn()} hideLabel />);

    const picker = screen.getByLabelText('Start Time');
    expect(picker.getAttribute('type')).toBe('time');
    expect(picker.value).toBe('09:00');
    expect(picker.className).toContain('time-input-native');
  });

  it('commits the native time value', () => {
    const onChange = vi.fn();
    render(<TimeInput label="End Time" value="" onChange={onChange} hideLabel />);

    fireEvent.change(screen.getByLabelText('End Time'), {
      target: { value: '14:00' },
    });
    expect(onChange).toHaveBeenCalledWith('14:00');
  });
});
