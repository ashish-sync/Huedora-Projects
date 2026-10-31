import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpsReviewHeader, { OpsReviewSlot, OpsReviewSlotProvider } from './OpsReviewHeader.jsx';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'month', label: 'This month' },
];

function HeaderHarness({ children, fallbackTotal = null }) {
  return (
    <MemoryRouter>
      <OpsReviewSlotProvider>
        <OpsReviewHeader
          presets={PRESETS}
          preset="month"
          onPreset={vi.fn()}
          from="2026-10-01"
          to="2026-10-31"
          onFrom={vi.fn()}
          onTo={vi.fn()}
          moduleId="camps"
          modules={[{ id: 'camps', label: 'Camp One' }, { id: 'assets', label: 'Asset One' }]}
          onModule={vi.fn()}
          onSubmit={vi.fn()}
          onClear={vi.fn()}
          fallbackTotal={fallbackTotal}
        />
        {children}
      </OpsReviewSlotProvider>
    </MemoryRouter>
  );
}

describe('OpsReviewHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the Camp One header chrome for every module', () => {
    render(
      <HeaderHarness fallbackTotal={{ label: 'Total assets', value: 12 }}>
        <OpsReviewSlot totalLabel="Total Camps" totalValue={11}>
          <label>
            <span>Method</span>
            <select aria-label="Method">
              <option>All</option>
            </select>
          </label>
        </OpsReviewSlot>
      </HeaderHarness>,
    );

    expect(screen.getByLabelText('From date')).toBeTruthy();
    expect(screen.getByLabelText('To date')).toBeTruthy();
    expect(screen.getByLabelText('Module')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('Total Camps')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByLabelText('Method')).toBeTruthy();
  });

  it('shows a table-module total when no slot is registered', () => {
    render(
      <HeaderHarness fallbackTotal={{ label: 'Total assets', value: 12 }} />,
    );

    expect(screen.getByText('Total assets')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getAllByLabelText('Module').length).toBeGreaterThan(0);
  });
});
