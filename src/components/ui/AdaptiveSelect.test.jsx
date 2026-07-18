import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdaptiveSelect from './AdaptiveSelect.jsx';

afterEach(cleanup);

function options(count) {
  return Array.from({ length: count }, (_, index) => (
    <option key={index + 1} value={String(index + 1)}>
      Choice {index + 1}
    </option>
  ));
}

function ControlledSelect({ count, onChange = () => {}, multiple = false, ...props }) {
  const [value, setValue] = useState(multiple ? [] : '');
  return (
    <AdaptiveSelect
      aria-label="Example"
      multiple={multiple}
      {...props}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(event);
      }}
    >
      {!multiple && <option value="">Select one</option>}
      {options(count)}
    </AdaptiveSelect>
  );
}

describe('AdaptiveSelect', () => {
  it('keeps nine choices as a native select', () => {
    render(<ControlledSelect count={9} />);
    expect(screen.getByLabelText('Example').tagName).toBe('SELECT');
  });

  it('turns ten choices into a searchable combobox', () => {
    render(<ControlledSelect count={10} />);
    expect(screen.getByRole('combobox', { name: 'Example' })).toBeTruthy();
  });

  it('filters and selects a matching choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSelect count={10} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Example' });

    await user.click(input);
    await user.type(input, 'Choice 10');
    await user.click(screen.getByText('Choice 10'));

    expect(onChange.mock.calls.at(-1)[0].target.value).toBe('10');
  });

  it('switches mode when dynamic choices reach the threshold', () => {
    const { rerender } = render(<ControlledSelect count={9} />);
    expect(screen.getByLabelText('Example').tagName).toBe('SELECT');
    rerender(<ControlledSelect count={10} />);
    expect(screen.getByRole('combobox', { name: 'Example' })).toBeTruthy();
  });

  it('propagates required and disabled state in searchable mode', () => {
    render(<ControlledSelect count={10} required disabled />);
    const input = document.querySelector('input[role="combobox"][aria-label="Example"]');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.disabled).toBe(true);
  });

  it('provides selectedOptions for a searchable multi-select', async () => {
    const onChange = vi.fn();
    render(<ControlledSelect count={10} multiple onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Example' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    const event = onChange.mock.calls.at(-1)[0];
    expect(event.target.value).toEqual(['1']);
    expect(event.target.selectedOptions[0].value).toBe('1');
  });
});
