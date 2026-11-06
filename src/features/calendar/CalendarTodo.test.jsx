import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarTodo from './CalendarTodo.jsx';

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}));

vi.mock('../../shared/api.js', () => ({
  api: (...args) => apiMock(...args),
}));

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    user: { id: 'u-alice', fullName: 'Alice Admin' },
    can: () => true,
    loading: false,
  }),
}));

describe('CalendarTodo', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path, options = {}) => {
      const method = String(options.method || 'GET').toUpperCase();
      if (String(path).startsWith('/calendar/events') && method === 'GET') {
        return {
          data: [
            {
              id: 'e-1',
              kind: 'task',
              title: 'Prep HCW list',
              body: 'Confirm camps',
              startAt: '2026-11-15T09:00:00.000Z',
              endAt: '2026-11-15T10:00:00.000Z',
              status: 'open',
              canEdit: true,
              canRespond: false,
              ownerId: 'u-alice',
              participants: [],
            },
          ],
        };
      }
      if (path === '/calendar/directory') {
        return {
          data: [{ id: 'u-bob', fullName: 'Bob Ops', designation: 'Operations' }],
        };
      }
      if (path === '/calendar/summary') {
        return { data: { openTasks: 1, pendingRequests: 0, badge: 1 } };
      }
      if (path === '/calendar/events' && method === 'POST') {
        return {
          data: {
            id: 'e-2',
            kind: options.body?.kind || 'task',
            title: options.body?.title,
            startAt: options.body?.startAt,
            endAt: options.body?.endAt,
            status: 'open',
            canEdit: true,
            canRespond: false,
            ownerId: 'u-alice',
            participants: [],
          },
        };
      }
      throw new Error(`Unexpected path: ${method} ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the current month and creates a timed task', async () => {
    const user = userEvent.setup();
    const onBadgeChange = vi.fn();
    render(<CalendarTodo onBadgeChange={onBadgeChange} />);

    expect(await screen.findByRole('grid', {}, { timeout: 10000 })).toBeTruthy();
    await waitFor(() => expect(onBadgeChange).toHaveBeenCalledWith(1));

    await user.click(screen.getByRole('button', { name: '+ Add' }));
    expect(await screen.findByRole('dialog', { name: 'Create calendar item' })).toBeTruthy();

    await user.type(screen.getByPlaceholderText('What needs to happen?'), 'Call vendor');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        '/calendar/events',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            kind: 'task',
            title: 'Call vendor',
          }),
        }),
      );
    });
  }, 20000);
});
