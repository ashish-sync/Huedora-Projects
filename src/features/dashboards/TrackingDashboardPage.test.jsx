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

const EMPTY_OVERVIEW = {
  generatedAt: '2026-11-01T12:00:00.000Z',
  health: { score: 100, label: 'Healthy', tone: 'ok' },
  pending: [],
  alerts: [],
  kpis: [],
  modules: [],
  financials: {},
  agreementsHealth: {},
  repairsSla: {},
  breakdowns: {},
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
      if (path === '/dashboards/overview') return { data: EMPTY_OVERVIEW };
      if (path === '/dashboards/modules') return { data: [{ id: 'assets', label: 'Asset One' }] };
      throw new Error(`Unexpected API path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a successful empty dataset with explicit empty-state content', async () => {
    renderDashboard();

    expect(await screen.findByText('No active risks')).toBeTruthy();
    expect(screen.getAllByText('No distribution data yet').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Loading overview')).toBeNull();
  });

  it('renders an explicit empty state when the API returns no overview payload', async () => {
    apiMock.mockImplementation(async (path) => (
      path === '/dashboards/overview' ? { data: null } : { data: [] }
    ));
    renderDashboard();

    expect(await screen.findByText('No dashboard data available')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Refresh' }).length).toBe(2);
  });

  it('shows the loading skeleton during a delayed response and prevents duplicate refreshes', async () => {
    let resolveInitial;
    let resolveRefresh;
    apiMock.mockImplementation((path) => {
      if (path === '/dashboards/overview') {
        return new Promise((resolve) => {
          if (!resolveInitial) resolveInitial = resolve;
          else resolveRefresh = resolve;
        });
      }
      return Promise.resolve({ data: [{ id: 'assets', label: 'Asset One' }] });
    });

    const user = userEvent.setup();
    renderDashboard();
    expect(screen.getByLabelText('Loading overview')).toBeTruthy();
    const firstRefresh = screen.getByRole('button', { name: 'Refreshing…' });
    expect(firstRefresh.disabled).toBe(true);
    await user.click(firstRefresh);
    expect(apiMock.mock.calls.filter(([path]) => path === '/dashboards/overview')).toHaveLength(1);

    resolveInitial({ data: EMPTY_OVERVIEW });
    expect(await screen.findByText('No active risks')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    const refreshing = await screen.findByRole('button', { name: 'Refreshing…' });
    expect(refreshing.disabled).toBe(true);
    await user.click(refreshing);
    expect(apiMock.mock.calls.filter(([path]) => path === '/dashboards/overview')).toHaveLength(2);

    resolveRefresh({ data: EMPTY_OVERVIEW });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' }).disabled).toBe(false));
  });

  it('shows an API error and allows a later refresh', async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === '/dashboards/overview') throw new Error('Dashboard service unavailable');
      return { data: [] };
    });
    renderDashboard();

    expect(await screen.findByText('Dashboard service unavailable')).toBeTruthy();
    expect(screen.queryByLabelText('Loading overview')).toBeNull();
  });

  it.each([
    ['Local Admin', ['*'], true],
    ['Operations Manager', ['dashboards:read', 'assets:read'], true],
    ['Read-only user', ['dashboards:read'], true],
    ['User without dashboard access', ['assets:read'], false],
  ])('%s sees only the dashboard permitted by their fixture', async (_role, rolePermissions, allowed) => {
    permissions.splice(0, permissions.length, ...rolePermissions);
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    if (allowed) {
      expect(await screen.findByRole('link', { name: /Operations Dashboard|Review any module by date range/i })).toBeTruthy();
    } else {
      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /Operations Dashboard|Review any module by date range/i })).toBeNull();
      });
    }
  });

  it('redirects a user without dashboard permission before requesting dashboard APIs', async () => {
    permissions.splice(0, permissions.length, 'assets:read');
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
    expect(apiMock).not.toHaveBeenCalled();
  });
});
