import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicOlaAddressAutocomplete from './PublicOlaAddressAutocomplete.jsx';

const SUGGESTION = {
  placeId: 'ola-platform:airport',
  label: 'Kempegowda International Airport Bengaluru (BLR)',
  secondaryText: 'KIAL Rd, Devanahalli, Bengaluru, Karnataka, India',
  campAddress: 'Kempegowda International Airport Bengaluru (BLR), KIAL Rd, Devanahalli, Bengaluru, Karnataka, India',
  latitude: '13.05158',
  longitude: '77.61194',
};

async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
}

describe('PublicOlaAddressAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not search until 3 characters and then waits 400ms', async () => {
    const autocomplete = vi.fn().mockResolvedValue([SUGGESTION]);
    const onChange = vi.fn();
    const { rerender } = render(
      <PublicOlaAddressAutocomplete value="Ke" lookup={{ autocomplete }} onChange={onChange} />,
    );
    await flushDebounce();
    expect(autocomplete).not.toHaveBeenCalled();

    rerender(
      <PublicOlaAddressAutocomplete value="Kem" lookup={{ autocomplete }} onChange={onChange} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(autocomplete).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(autocomplete).toHaveBeenCalledWith('Kem');
    expect(screen.getByRole('option', { name: /Kempegowda/ })).toBeTruthy();
  });

  it('populates address and coordinates on suggestion select', async () => {
    const autocomplete = vi.fn().mockResolvedValue([SUGGESTION]);
    const onChange = vi.fn();
    render(
      <PublicOlaAddressAutocomplete value="Kem" lookup={{ autocomplete }} onChange={onChange} />,
    );
    await flushDebounce();
    fireEvent.click(screen.getByRole('option', { name: /Kempegowda/ }));
    expect(onChange).toHaveBeenCalledWith({
      campAddress: SUGGESTION.campAddress,
      addressManualEntry: false,
      googlePlaceId: SUGGESTION.placeId,
      latitude: SUGGESTION.latitude,
      longitude: SUGGESTION.longitude,
      pinCode: '',
    });
  });

  it('keeps the field editable when suggestions are empty or the service fails', async () => {
    const autocomplete = vi.fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('network'));
    const onChange = vi.fn();
    const { rerender } = render(
      <PublicOlaAddressAutocomplete value="Zzz" lookup={{ autocomplete }} onChange={onChange} />,
    );
    await flushDebounce();
    expect(screen.getByText(/No matching addresses/i)).toBeTruthy();

    rerender(
      <PublicOlaAddressAutocomplete value="Zzzz" lookup={{ autocomplete }} onChange={onChange} />,
    );
    await flushDebounce();
    expect(screen.getByText(/Suggestions unavailable/i)).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Manual clinic address' } });
    expect(onChange).toHaveBeenCalledWith({
      campAddress: 'Manual clinic address',
      addressManualEntry: true,
      googlePlaceId: '',
      latitude: '',
      longitude: '',
    });
  });
});
