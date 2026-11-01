import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CampAddressField from './CampAddressField.jsx';

afterEach(() => {
  cleanup();
});

describe('CampAddressField', () => {
  it('stays a plain address box when no lookup is provided', () => {
    const onChange = vi.fn();
    render(<CampAddressField value={{ campAddress: '' }} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Enter camp / clinic address');
    fireEvent.change(input, { target: { value: '12 MG Road' } });
    expect(onChange).toHaveBeenCalledWith({
      campAddress: '12 MG Road',
      addressManualEntry: true,
      googlePlaceId: '',
      latitude: '',
      longitude: '',
    });
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
