import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage, { parseQuickAccessUrlInput } from './DashboardPage.jsx';

const { apiMock, permissions, testUser } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  permissions: [],
  testUser: { id: 'admin-1', fullName: 'Local Admin', role: 'admin' },
}));

vi.mock('../../shared/api.js', () => ({
  api: (...args) => apiMock(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    can: (perm) => permissions.includes('*') || permissions.includes(perm),
    user: testUser,
    loading: false,
  }),
}));

const MOCK_OVERVIEW = {
  generatedAt: '2026-11-02T10:00:00.000Z',
  health: { score: 94, label: 'Healthy', tone: 'ok' },
  kpis: [
    { id: 'assets', label: 'Assets', value: 42, href: '/asset-inventory' },
    { id: 'camps', label: 'Camps', value: 18, href: '/camps/manage' },
    { id: 'pending-requests', label: 'Pending requests', value: 3, href: '/asset-requests', tone: 'warn' },
    { id: 'open-repairs', label: 'Open repairs', value: 1, href: '/asset-requests', tone: 'warn' },
    { id: 'verify-exceptions', label: 'Verify exceptions', value: 0, href: '/verifications', tone: 'ok' },
    { id: 'contacts', label: 'Contacts', value: 110, href: '/master-data?scope=document&entity=contacts' },
    { id: 'expense-total', label: 'Expense total (INR)', value: 450000, href: '/finance', format: 'currency' },
    { id: 'invoice-open', label: 'Open invoices', value: 4, href: '/finance', tone: 'warn' },
  ],
  modules: [
    { id: 'assets', label: 'Asset One', href: '/asset-inventory', primary: 42, primaryLabel: 'Assets', secondary: 5, secondaryLabel: 'Statuses', status: 'ok' },
    { id: 'agreements', label: 'Document One', href: '/agreements', primary: 12, primaryLabel: 'Agreements', secondary: 1, secondaryLabel: 'Expiring', status: 'ok' },
    { id: 'verifications', label: 'Verification One', href: '/verifications', primary: 30, primaryLabel: 'Records', secondary: 0, secondaryLabel: 'Exceptions', status: 'ok' },
    { id: 'camps', label: 'Camp One', href: '/camps/manage', primary: 18, primaryLabel: 'Camps', secondary: 4, secondaryLabel: 'Statuses', status: 'ok' },
    { id: 'asset-requests', label: 'Request One', href: '/asset-requests', primary: 3, primaryLabel: 'Pending', secondary: 15, secondaryLabel: 'Total', status: 'warn' },
    { id: 'logistics', label: 'Movement One', href: '/movement-one', primary: 2, primaryLabel: 'In progress', secondary: 28, secondaryLabel: 'Dispatches', status: 'ok' },
    { id: 'finance', label: 'Finance One', href: '/finance', primary: 4, primaryLabel: 'Open items', secondary: 19, secondaryLabel: 'Docs', status: 'warn' },
    { id: 'contacts', label: 'Contact Directory', href: '/master-data?scope=document&entity=contacts', primary: 110, primaryLabel: 'Contacts', secondary: 0, secondaryLabel: '', status: 'ok' },
  ],
  pending: [
    {
      id: 'requests',
      label: 'Request One awaiting approval',
      count: 3,
      severity: 'medium',
      href: '/asset-requests',
      module: 'asset-requests',
    },
  ],
  alerts: [
    {
      id: 'sla',
      severity: 'critical',
      label: 'Repair SLA breached',
      detail: '1 open ticket past SLA due date',
      href: '/asset-requests',
      module: 'asset-requests',
    },
  ],
  financials: {
    expenseTotal: 450000,
    expenseOpen: 2,
    invoiceOpen: 4,
    commercialDraft: 1,
    commercialSubmitted: 1,
  },
  breakdowns: {
    campsByStatus: { SCHEDULED: 6, ONGOING: 2, COMPLETED: 10 },
    assetsByStatus: { AVAILABLE: 30, IN_USE: 10, MAINTENANCE: 2 },
  },
};

function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage homepage', () => {
  beforeEach(() => {
    localStorage.clear();
    permissions.splice(0, permissions.length, '*');
    testUser.id = 'admin-1';
    testUser.fullName = 'Local Admin';
    testUser.role = 'admin';
    testUser.systemRole = 'Super Admin';
    apiMock.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path === '/dashboards/overview') return { data: MOCK_OVERVIEW };
      if (String(path).startsWith('/dashboards/camp-pipeline')) {
        return {
          data: {
            total: 0,
            stages: [
              { id: 'request', total: 0, byStatus: {}, statuses: [] },
              { id: 'assignment', total: 0, byStatus: {}, statuses: [] },
              { id: 'execution', total: 0, byStatus: {}, statuses: [] },
              { id: 'financial', total: 0, byStatus: {}, statuses: [] },
            ],
          },
        };
      }
      if (String(path).startsWith('/camp-ops/client-masters/ops-board-filters')) {
        return { data: { methods: [], assignedUsers: [] } };
      }
      if (String(path).startsWith('/dashboards/camp-quality')) {
        return {
          data: {
            metric: 'punctuality',
            label: 'Punctuality',
            buckets: [
              { key: 'Pending', count: 2 },
              { key: 'Cancelled', count: 0 },
              { key: 'Good', count: 5 },
              { key: 'Average', count: 1 },
              { key: 'Poor', count: 0 },
            ],
            summary: {},
          },
        };
      }
      if (String(path).startsWith('/notifications')) return { data: [] };
      if (path === '/chat/unread-count') return { data: { count: 0 } };
      if (path === '/chat/directory') return { data: [] };
      if (path === '/chat/conversations') return { data: [] };
      if (String(path).startsWith('/chat/')) return { data: [] };
      if (path === '/calendar/summary') return { data: { openTasks: 0, pendingRequests: 0, badge: 0 } };
      if (String(path).startsWith('/calendar/')) return { data: [] };
      throw new Error(`Unexpected path: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('loads overview telemetry on the Business Overview dashboard', async () => {
    renderDashboardPage();

    expect(await screen.findByRole('heading', { name: 'Business Overview' }, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tylo One Dashboard/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'My View' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Welcome' }, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^Welcome Local$/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Date range' })).toBeTruthy();
    expect(screen.getByLabelText('From date')).toBeTruthy();
    expect(screen.getByLabelText('To date')).toBeTruthy();
    expect(screen.getByLabelText('Apply date range')).toBeTruthy();
    expect(screen.getByLabelText('Reset date range')).toBeTruthy();
    expect(screen.getByLabelText('Camp quality metric')).toBeTruthy();
    await waitFor(() => {
      expect(apiMock.mock.calls.some(([path]) => String(path).startsWith('/dashboards/camp-quality'))).toBe(true);
    });
    expect(await screen.findByText('Pending')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Attention required' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Quick access' })).toBeTruthy();
    expect(screen.getByText('Department performance')).toBeTruthy();
    expect(screen.getByText('Request One awaiting approval')).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('/dashboards/overview');
    expect(apiMock).toHaveBeenCalledWith('/chat/unread-count');
  }, 20000);

  it('lets an admin open My View without changing overview APIs', async () => {
    const user = userEvent.setup();
    renderDashboardPage();

    expect(await screen.findByRole('heading', { name: 'Business Overview' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'My View' }));
    expect(screen.getByRole('heading', { name: 'My View' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Pinned KPIs' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Quick Access Shortcuts' })).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('/dashboards/overview');
  });

  it('keeps staff without dashboards:read on My View and does not fetch overview', async () => {
    permissions.splice(0, permissions.length, 'camps:read', 'camps:request');
    testUser.fullName = 'Rahul Verma';
    testUser.role = 'Camp Coordinator';
    renderDashboardPage();

    expect(await screen.findByRole('heading', { name: 'My View' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tylo One Dashboard/i }).disabled).toBe(true);
    expect(screen.getByText('Camp One')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Financial Documents/i })).toBeNull();
    expect(apiMock).not.toHaveBeenCalledWith('/dashboards/overview');
  });

  it('shows only authorised modules for a single-module user', async () => {
    const user = userEvent.setup();
    permissions.splice(0, permissions.length, 'verifications:read');
    testUser.role = 'Viewer';
    renderDashboardPage();

    expect(await screen.findByRole('heading', { name: 'My View' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Customize View/i }));
    expect(screen.getByLabelText('Verification One')).toBeTruthy();
    expect(screen.queryByLabelText('Camp One')).toBeNull();
    expect(screen.queryByLabelText('Finance One')).toBeNull();
    expect(screen.queryByLabelText('Document One')).toBeNull();
  });

  it('shows only authorised modules for a dual-module user', async () => {
    const user = userEvent.setup();
    permissions.splice(0, permissions.length, 'agreements:read', 'finance:read');
    testUser.role = 'Viewer';
    renderDashboardPage();

    expect(await screen.findByRole('heading', { name: 'My View' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Customize View/i }));
    expect(screen.getByLabelText('Document One')).toBeTruthy();
    expect(screen.getByLabelText('Finance One')).toBeTruthy();
    expect(screen.queryByLabelText('Camp One')).toBeNull();
    expect(screen.queryByLabelText('Asset One')).toBeNull();
  });

  it('removes Quick Access pins from Customize tile controls and stores them per user', async () => {
    const user = userEvent.setup();
    renderDashboardPage();

    const customize = await screen.findByRole('button', { name: /Customize pins/i });
    await user.click(customize);

    const removeAsset = screen.getByRole('button', { name: /Remove Asset One/i });
    await user.click(removeAsset);

    const saved = JSON.parse(localStorage.getItem('tylo_one_my_view_config') || '{}');
    expect(saved.users?.['admin-1']?.pinnedModules || []).not.toContain('asset-one');
    expect(screen.getAllByRole('button', { name: 'Add shortcut' }).length).toBeGreaterThan(0);
  });

  it('parses internal page URLs for Quick Access shortcuts', () => {
    expect(parseQuickAccessUrlInput('/camps/manage')).toEqual({
      title: 'Manage',
      to: '/camps/manage',
    });
    expect(parseQuickAccessUrlInput('Ops Board | /camps/ops-board')).toEqual({
      title: 'Ops Board',
      to: '/camps/ops-board',
    });
    expect(parseQuickAccessUrlInput('javascript:alert(1)')).toBeNull();
    expect(parseQuickAccessUrlInput('https://evil.example/camps')).toBeNull();
  });

  it('adds a page URL widget under Quick Access Customize', async () => {
    const user = userEvent.setup();
    renderDashboardPage();

    await user.click(await screen.findByRole('button', { name: /Customize pins/i }));
    await user.click(screen.getAllByRole('button', { name: 'Add shortcut' })[0]);

    const input = screen.getByPlaceholderText(/Module name or page URL/i);
    await user.type(input, 'Camp Ops | /camps/ops-board');
    await user.click(screen.getByRole('option', { name: /Add page · Camp Ops/i }));

    const saved = JSON.parse(localStorage.getItem('tylo_one_my_view_config') || '{}');
    const items = saved.users?.['admin-1']?.quickAccessItems || [];
    expect(items.some((item) => item.type === 'url' && item.to === '/camps/ops-board' && item.title === 'Camp Ops')).toBe(true);

    await user.click(screen.getByRole('button', { name: /Customize pins/i }));
    expect(screen.getByRole('link', { name: /Camp Ops/i })).toBeTruthy();
  });

  it('filters modules and workflows and can clear the search', async () => {
    const user = userEvent.setup();
    renderDashboardPage();

    const searchInput = await screen.findByPlaceholderText(/Filter modules or workflows/i);
    await user.type(searchInput, 'Movement');

    expect(await screen.findByRole('region', { name: 'Search results' })).toBeTruthy();
    expect(screen.getByText('Movement One')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(searchInput.value).toBe('');
    expect(screen.getByRole('region', { name: 'Quick access' })).toBeTruthy();
  });
});
