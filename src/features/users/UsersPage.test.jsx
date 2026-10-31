import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from './UsersPage.jsx';

const api = vi.fn();

vi.mock('../../shared/api.js', () => ({
  api: (...args) => api(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    can: (perm) => perm === 'users:read' || perm === 'users:write',
  }),
}));

describe('UsersPage team directory', () => {
  beforeEach(() => {
    api.mockResolvedValue({
      data: [
        {
          id: 'u1',
          fullName: 'Priya Sharma',
          email: 'priya@tylo.test',
          designation: 'Camp Coordinator',
          isActive: true,
          lastLoginAt: '2026-10-30T10:00:00.000Z',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows people in business language and opens details', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Team' })).toBeTruthy();
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.queryByText(/username/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /Priya Sharma/i }));
    expect(await screen.findByText('Last signed in')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Teammate details' })).toBeTruthy();
  });
});
