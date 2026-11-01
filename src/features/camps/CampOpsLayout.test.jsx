import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampOpsLayout from './CampOpsLayout.jsx';

vi.mock('./useCampOpsAuth.js', () => ({
  useCampOpsAuth: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock('./components/CampManageHeaderActions.jsx', () => ({
  CampManageHeaderActions: () => null,
}));

vi.mock('./components/CampWorkingStageSelect.jsx', () => ({
  CampWorkingStageSelect: () => null,
}));

function renderLayout(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/camp-one" element={<CampOpsLayout />}>
          <Route path="manage" element={<div>Manage body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampOpsLayout return context', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not show dashboard Back when Camp One was opened directly', async () => {
    renderLayout('/camp-one/manage');
    expect(await screen.findByText('Manage body')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '← Back' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Operations Dashboard' })).toBeNull();
  });

  it('keeps Operations Dashboard in crumbs without a Back control', async () => {
    const returnTo = '/dashboard?tab=drilldown&module=camps&from=2026-10-01&to=2026-10-31&preset=month';
    renderLayout(`/camp-one/manage?stage=execution&status=planned&returnTo=${encodeURIComponent(returnTo)}`);
    expect(await screen.findByText('Manage body')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '← Back' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Operations Dashboard' }).getAttribute('href')).toBe(returnTo);
  });
});
