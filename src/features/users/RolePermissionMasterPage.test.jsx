import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RolePermissionMasterPage from './RolePermissionMasterPage.jsx';

const api = vi.fn();
const downloadExcel = vi.fn();

vi.mock('../../shared/api.js', () => ({
  api: (...args) => api(...args),
  downloadExcel: (...args) => downloadExcel(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    can: () => true,
    user: { id: 'u1', fullName: 'Priya Sharma' },
  }),
}));

const MOCK_ROLES = [
  { _id: 'r_admin', name: 'Admin', permissions: ['*'] },
  { _id: 'r_coord', name: 'Camp Coordinator', permissions: ['camp_ops:read', 'camp_ops:write'] },
];

const MOCK_MODULES = [
  {
    id: 'camps',
    label: 'Camp One',
    description: 'Camp scheduling and lifecycle management',
    actions: {
      view: ['camp_ops:read'],
      add: ['camp_ops:write'],
    },
  },
  {
    id: 'finance',
    label: 'Finance One',
    description: 'Invoices, vendor bills, and settlements',
    actions: {
      view: ['finance:read'],
      pay: ['finance:pay'],
    },
  },
];

const MOCK_USERS = [
  {
    id: 'u1',
    fullName: 'Priya Sharma',
    email: 'priya@tylo.test',
    username: 'priya',
    designation: 'Healthcare Camp Coordinator',
    systemRole: 'User',
    isActive: true,
    roles: [{ id: 'r_coord', name: 'Camp Coordinator' }],
    permissions: ['camp_ops:read', 'camp_ops:write'],
  },
  {
    id: 'u2',
    fullName: 'Aarav Patel',
    email: 'aarav@tylo.test',
    username: 'aarav',
    designation: 'Director',
    systemRole: 'Admin',
    isActive: false,
    roles: [],
    permissions: [],
  },
];

describe('RolePermissionMasterPage Access Control', () => {
  beforeEach(() => {
    api.mockImplementation(async (path) => {
      const p = String(path);
      if (p.startsWith('/users/roles')) return { data: MOCK_ROLES };
      if (p.startsWith('/users/permissions')) return { data: { modules: MOCK_MODULES } };
      if (p.startsWith('/users/designations')) {
        return { data: ['Healthcare Camp Coordinator', 'Director'], accessTemplates: {} };
      }
      if (p.startsWith('/users/hierarchy')) {
        return {
          data: {
            tree: [{ id: 'u1', fullName: 'Priya Sharma', email: 'priya@tylo.test', directReports: [] }],
            people: MOCK_USERS,
          },
        };
      }
      if (p.startsWith('/users?')) return { data: MOCK_USERS };
      return { data: {} };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Access Control with directory, KPIs, and Control Center', async () => {
    render(
      <MemoryRouter>
        <RolePermissionMasterPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Access Control' })).toBeTruthy();
    expect(screen.getByText('People Directory')).toBeTruthy();
    expect(screen.getByText('Priya Sharma (you)')).toBeTruthy();
    expect(screen.getByText('Aarav Patel')).toBeTruthy();
    expect(screen.getByText('Camp One')).toBeTruthy();
    expect(screen.getByText('Finance One')).toBeTruthy();
    expect(screen.getByText('Admin all Access')).toBeTruthy();
  });

  it('filters people using the directory search box', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RolePermissionMasterPage />
      </MemoryRouter>,
    );

    const searchInput = await screen.findByLabelText('Search people');
    await user.type(searchInput, 'Aarav');

    expect(screen.getByText('Aarav Patel')).toBeTruthy();
    expect(screen.queryByText('Priya Sharma (you)')).toBeNull();
  });

  it('switches the active editing user when clicked in directory', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RolePermissionMasterPage />
      </MemoryRouter>,
    );

    await screen.findByText('Priya Sharma (you)');
    const aaravBtn = screen.getByRole('button', { name: /Aarav Patel/i });
    await user.click(aaravBtn);

    expect(screen.getByDisplayValue('aarav@tylo.test')).toBeTruthy();
    expect(screen.getByDisplayValue('Director')).toBeTruthy();
  });

  it('toggles to Org hierarchy tab', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RolePermissionMasterPage />
      </MemoryRouter>,
    );

    const hierarchyTab = await screen.findByRole('tab', { name: /Org hierarchy/i });
    await user.click(hierarchyTab);

    expect(await screen.findByRole('heading', { name: 'Organizational hierarchy' })).toBeTruthy();
  });

  it('initiates Excel export on clicking Download Excel', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RolePermissionMasterPage />
      </MemoryRouter>,
    );

    const downloadBtn = await screen.findByRole('button', { name: /Download Excel/i });
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(downloadExcel).toHaveBeenCalledWith('/users/export', 'Users_Master.xlsx');
    });
  });

  it('switches to create mode on clicking New person', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RolePermissionMasterPage />
      </MemoryRouter>,
    );

    const newBtn = await screen.findByRole('button', { name: 'New person' });
    await user.click(newBtn);

    expect(screen.getByRole('heading', { name: 'Create person' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add person' })).toBeTruthy();
  });
});

