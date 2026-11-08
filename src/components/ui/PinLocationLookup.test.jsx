import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import PinLocationLookup from './PinLocationLookup.jsx';
import { GeoLookupContext } from '../../shared/GeoLookupContext.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function PinHarness({ initial = {}, lookupPin, onValueChange, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <GeoLookupContext.Provider value={lookupPin ? { lookupPin } : undefined}>
      <PinLocationLookup
        {...props}
        value={value}
        onChange={(next) => {
          setValue((prev) => ({ ...prev, ...next }));
          onValueChange?.(next);
        }}
      />
    </GeoLookupContext.Provider>
  );
}

describe('PinLocationLookup', () => {
  it('renders all 4 fields by default', () => {
    render(<PinLocationLookup value={{ pinCode: '', state: '', zone: '', district: '' }} />);

    expect(screen.getByPlaceholderText('6-digit PIN')).toBeTruthy();
    expect(screen.getAllByPlaceholderText('Auto-filled from PIN')).toHaveLength(3);
    expect(screen.getByText('State')).toBeTruthy();
    expect(screen.getByText('Zone')).toBeTruthy();
    expect(screen.getByText('District')).toBeTruthy();
  });

  it('renders only the PIN Code field when pinOnly={true}', () => {
    render(
      <PinLocationLookup
        pinOnly
        required
        value={{ pinCode: '560001', state: 'Karnataka', zone: 'South Zone', district: 'Bengaluru Urban' }}
      />,
    );

    expect(screen.getByPlaceholderText('6-digit PIN')).toBeTruthy();
    expect(screen.getByText(/PIN Code/)).toBeTruthy();
    expect(screen.queryByText('State')).toBeNull();
    expect(screen.queryByText('Zone')).toBeNull();
    expect(screen.queryByText('District')).toBeNull();
    expect(screen.queryByPlaceholderText('Auto-filled from PIN')).toBeNull();
  });

  it('triggers lookup and emits resolved location on 6-digit PIN entry', async () => {
    const onChange = vi.fn();
    const lookupPin = vi.fn().mockResolvedValue({
      resolved: {
        stateName: 'Karnataka',
        districtName: 'Bengaluru Urban',
        zone: 'South Zone',
        stateId: 's-kar',
        districtId: 'd-blr',
      },
    });

    render(
      <PinHarness
        pinOnly
        onValueChange={onChange}
        initial={{ pinCode: '' }}
        lookupPin={lookupPin}
      />,
    );

    const input = screen.getByPlaceholderText('6-digit PIN');
    fireEvent.change(input, { target: { value: '560001' } });

    await waitFor(() => expect(lookupPin).toHaveBeenCalledWith('560001'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          pinCode: '560001',
          state: 'Karnataka',
          district: 'Bengaluru Urban',
          zone: 'South Zone',
          stateId: 's-kar',
          districtId: 'd-blr',
        }),
      );
    });
  });

  it('shows not found message when PIN is not found in master', async () => {
    const lookupPin = vi.fn().mockResolvedValue({ resolved: null });

    render(
      <PinHarness
        pinOnly
        initial={{ pinCode: '' }}
        lookupPin={lookupPin}
      />,
    );

    const input = screen.getByPlaceholderText('6-digit PIN');
    fireEvent.change(input, { target: { value: '999999' } });

    expect(await screen.findByText(/PIN not found in master/i)).toBeTruthy();
  });
});
