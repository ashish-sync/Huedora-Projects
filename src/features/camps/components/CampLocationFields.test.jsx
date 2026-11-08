import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CampLocationFields from './CampLocationFields.jsx';
import { GeoLookupContext } from '../../../shared/GeoLookupContext.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CampLocationFields', () => {
  it('renders all location fields in default mode', () => {
    render(<CampLocationFields value={{ pincode: '', city: '' }} />);

    expect(screen.getByPlaceholderText('6-digit PIN')).toBeTruthy();
    expect(screen.getByText('State')).toBeTruthy();
    expect(screen.getByText('Zone')).toBeTruthy();
    expect(screen.getByText('District')).toBeTruthy();
    expect(screen.getByText(/City/)).toBeTruthy();
  });

  it('renders only PIN Code and City in a pair row when pinAndCityOnly={true}', () => {
    const { container } = render(
      <CampLocationFields
        pinAndCityOnly
        required
        value={{ pincode: '560001', stateId: 's-1', city: '' }}
      />,
    );

    const pairRow = container.querySelector('.camp-request-pair-row');
    expect(pairRow).toBeTruthy();
    expect(screen.getByPlaceholderText('6-digit PIN')).toBeTruthy();
    expect(screen.getByText(/City/)).toBeTruthy();
    expect(screen.queryByText('State')).toBeNull();
    expect(screen.queryByText('Zone')).toBeNull();
    expect(screen.queryByText('District')).toBeNull();
  });

  it('loads cities when stateId is present and allows selecting a city', async () => {
    const onChange = vi.fn();
    const fetchCities = vi.fn().mockResolvedValue([
      { _id: 'city-1', name: 'Bengaluru' },
      { _id: 'city-2', name: 'Mysuru' },
    ]);

    render(
      <GeoLookupContext.Provider value={{ fetchCities }}>
        <CampLocationFields
          pinAndCityOnly
          value={{ pincode: '560001', stateId: 's-kar', city: '', cityId: '' }}
          onChange={onChange}
        />
      </GeoLookupContext.Provider>,
    );

    await waitFor(() => expect(fetchCities).toHaveBeenCalledWith('s-kar'));
    expect(screen.getByRole('combobox', { name: 'City' })).toBeTruthy();
    expect(screen.getByText('Bengaluru')).toBeTruthy();
    expect(screen.getByText('Mysuru')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'City' }), {
      target: { value: 'city-1' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: 'city-1',
        city: 'Bengaluru',
      }),
    );
  });
});

