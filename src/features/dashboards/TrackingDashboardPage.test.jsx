import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TrackingDashboardPage from './TrackingDashboardPage.jsx';
import DashboardPage from './DashboardPage.jsx';
import RequirePermission from '../../app/RequirePermission.jsx';

const { apiMock, permissions } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  permissions: [],
}));

vi.mock('../../shared/api.js', () => ({
  api: (...args) => apiMock(...args),
  downloadExcel: vi.fn(),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    can: (permission) => permissions.includes('*') || permissions.includes(permission),
    user: { id: 'permission-fixture', fullName: 'QA Fixture' },
    loading: false,
  }),
}));

const EMPTY_KPIS = {
  generatedAt: '2026-11-10T12:00:00.000Z',
  from: '2026-11-01',
  to: '2026-11-10',
  limitations: ['Asset status is a current-state snapshot'],
  modules: {
    assetOne: {
      statuses: [
        { status: 'Tylo Office', qty: 2, value: 1000, pctQty: 50, pctValue: 50, href: '/asset-one?agreementStatus=Tylo%20Office' },
      ],
    },
    verificationOne: {
      conditions: [
        { key: 'SAFE', label: 'Safe', qty: 1, pctQty: 100, href: '/verification-one?condition=SAFE' },
      ],
    },
    campOne: {
      chargeability: [{ key: 'Chargeable', label: 'Chargeable', qty: 1, pct: 100, href: '/camp-one/manage' }],
      punctuality: [{ key: 'Good', label: 'Good', qty: 1, pct: 100, href: '/camp-one/manage' }],
      cancellation: {
        eligibleTotal: 1,
        cancelledTotal: 0,
        ratePct: 0,
        byTylo: { qty: 0, pct: 0, href: '/camp-one/manage' },
        byClient: { qty: 0, pct: 0, href: '/camp-one/manage' },
        href: '/camp-one/manage',
      },
    },
    masterOne: {
      newHcws: { qty: 1, pct: 50, href: '/master-one' },
      existingHcws: { qty: 1, pct: 50, href: '/master-one' },
    },
    movementOne: {
      inward: { qty: 3, value: 300, href: '/movement-one/inward' },
      outward: { qty: 1, value: 100, href: '/movement-one/outward' },
      closingBalance: { qty: 2, value: 200, href: '/movement-one/inward', logic: 'Inward − Outward' },
    },
    financeOne: {
      revenue: { qty: 2, value: 5000, href: '/finance-one/billing/invoice' },
      outstanding: { qty: 1, value: 1000, creditsApplied: 0, href: '/finance-one/billing/invoice' },
      cost: { qty: 1, value: 400, href: '/finance-one/payouts' },
    },
  },
};

function renderDashboard(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/dashboard"
          element={(
            <RequirePermission anyOf={['dashboards:read']}>
              <TrackingDashboardPage />
            </RequirePermission>
          )}
        />
        <Route path="/" element={<h1>Home</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Operations Dashboard runtime states and access', () => {
  beforeEach(() => {
    permissions.splice(0, permissions.length, '*');
    apiMock.mockImplementation(async (path) => {
      if (path === '/dashboards/modules') return { data: [{ id: 'assets', label: 'Asset One' }] };
      if (String(path).startsWith('/dashboards/ops-overview-kpis')) return { data: EMPTY_KPIS };
      throw new Error(`Unexpected API path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('defaults to Overview and loads six-module KPI architecture', async () => {
    renderDashboard();

    expect((await screen.findByRole('tab', { name: 'Overview' })).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('heading', { name: 'Asset One' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Verification One' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Camp One' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Master One' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Movement One' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Finance One' })).toBeTruthy();
    expect(screen.getByText('Cancelled by Tylo')).toBeTruthy();
    expect(screen.getByText('Cancelled by Client')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Complete project health' })).toBeNull();
    expect(apiMock.mock.calls.some(([path]) => String(path).startsWith('/dashboards/ops-overview-kpis'))).toBe(true);
  });

  it('keeps Module review available from the Overview tab', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByRole('heading', { name: 'Asset One' });
    await user.click(screen.getByRole('tab', { name: 'Module review' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Module review' }).getAttribute('aria-selected')).toBe('true');
    });
    expect(screen.getByRole('heading', { name: 'Choose a module to review' })).toBeTruthy();
  });

  it.each([
    ['Local Admin', ['*'], true],
    ['Operations Manager', ['dashboards:read', 'assets:read'], true],
    ['Read-only user', ['dashboards:read'], true],
    ['User without dashboard access', ['assets:read'], false],
  ])('%s sees only the dashboard permitted by their fixture', async (_role, rolePermissions, allowed) => {
    permissions.splice(0, permissions.length, ...rolePermissions);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const dashboardToggle = await screen.findByRole('button', { name: /Tylo One Dashboard/i });

    if (allowed) {
      expect(screen.getByRole('heading', { name: 'Business Overview' })).toBeTruthy();
      expect(dashboardToggle.disabled).toBe(false);
      expect(dashboardToggle.getAttribute('aria-pressed')).toBe('true');

      await user.type(screen.getByPlaceholderText(/Filter modules or workflows/i), 'Operations');
      expect(await screen.findByRole('link', { name: /Operations Dashboard/i })).toBeTruthy();
    } else {
      expect(dashboardToggle.disabled).toBe(true);
    }
  });
});
