import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuditPage from './AuditPage.jsx';

const api = vi.fn();
const authState = { can: () => true, isAdmin: () => false };

vi.mock('../../shared/api.js', () => ({
  api: (...args) => api(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => authState,
}));

const ROW = {
  _id: 'a1',
  at: '2026-10-31T06:12:00.000Z',
  actorEmail: 'priya@tylo.test',
  action: 'camp_ops.approve',
  entityType: 'camp_ops_camp',
  entityId: 'camp-1',
  result: 'SUCCESS',
  after: { campId: '26-10-0042' },
};

describe('AuditPage Activity Log', () => {
  beforeEach(() => {
    authState.can = () => true;
    authState.isAdmin = () => false;
    api.mockResolvedValue({
      data: [ROW],
      meta: { page: 1, limit: 25, total: 1, pages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a business title instead of the event code and opens details on click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Activity Log' })).toBeTruthy();
    expect(screen.getByText('Approved a camp')).toBeTruthy();
    expect(screen.queryByText('camp_ops.approve')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Technical log' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Approved a camp/i }));
    expect(await screen.findByText(/priya@tylo.test approved a camp/i)).toBeTruthy();
    expect(screen.getAllByText('26-10-0042').length).toBeGreaterThan(0);
  });

  it('keeps the raw technical log behind admin access', async () => {
    authState.isAdmin = () => true;
    render(
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>,
    );

    const techTab = await screen.findByRole('tab', { name: 'Technical log' });
    await userEvent.setup().click(techTab);
    await waitFor(() => {
      expect(screen.getByText('camp_ops.approve')).toBeTruthy();
    });
  });
});
