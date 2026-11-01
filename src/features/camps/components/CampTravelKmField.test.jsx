import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CampTravelKmField from './CampTravelKmField.jsx';

describe('CampTravelKmField', () => {
  afterEach(() => cleanup());

  it('marks an auto value and keeps the field editable', () => {
    const onKmChange = vi.fn();
    render(
      <CampTravelKmField
        value="24.6"
        source="auto"
        status="Estimated from HCW PIN 400058 to camp venue (round trip)."
        onKmChange={onKmChange}
      />,
    );
    expect(screen.getByText('Estimated')).toBeTruthy();
    expect(screen.getByText(/PIN 400058/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Why was the estimate changed/)).toBeNull();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
    expect(onKmChange).toHaveBeenCalledWith('30');
  });

  it('records a manual override reason without blocking the field', () => {
    const onReasonChange = vi.fn();
    render(
      <CampTravelKmField
        value="18"
        source="manual"
        status="Travel estimate unavailable — enter distance manually."
        reason=""
        onReasonChange={onReasonChange}
      />,
    );
    expect(screen.getByText('Manual')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Why was the estimate changed/), {
      target: { value: 'Took a different route' },
    });
    expect(onReasonChange).toHaveBeenCalledWith('Took a different route');
  });
});
