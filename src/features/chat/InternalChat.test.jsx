import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InternalChat from './InternalChat.jsx';

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

describe('InternalChat', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path, options = {}) => {
      const method = String(options.method || 'GET').toUpperCase();
      if (path === '/chat/directory') {
        return {
          data: [
            { id: 'u-bob', fullName: 'Bob Ops', email: 'bob@tylo.test', designation: 'Operations' },
          ],
        };
      }
      if (path === '/chat/conversations' && method === 'GET') {
        return { data: [] };
      }
      if (path === '/chat/conversations' && method === 'POST') {
        return {
          data: {
            id: 'c-1',
            peer: { id: 'u-bob', fullName: 'Bob Ops', designation: 'Operations' },
            lastMessagePreview: '',
            unreadCount: 0,
          },
        };
      }
      if (String(path).startsWith('/chat/conversations/c-1/messages') && method === 'GET') {
        return { data: [], meta: { total: 0, page: 1, limit: 80 } };
      }
      if (String(path).startsWith('/chat/conversations/c-1/messages') && method === 'POST') {
        return {
          data: {
            id: 'm-1',
            conversationId: 'c-1',
            senderId: 'u-alice',
            body: options.body?.body || 'Hello',
            createdAt: '2026-11-06T10:00:00.000Z',
            readBy: ['u-alice'],
          },
        };
      }
      if (String(path).endsWith('/read') && method === 'POST') {
        return { data: { updated: 0 } };
      }
      throw new Error(`Unexpected path: ${method} ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists colleagues and sends a direct message', async () => {
    const user = userEvent.setup();
    render(<InternalChat />);

    const peerButton = await screen.findByRole('button', { name: /Bob/i }, { timeout: 10000 });
    await user.click(peerButton);

    expect(await screen.findByText(/Say hello to start the conversation/i, {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText('Message Bob')).toBeTruthy();
    expect(screen.getByLabelText('Type a message')).toBeTruthy();

    const input = screen.getByLabelText('Type a message');
    await user.clear(input);
    await user.type(input, 'Hello Bob');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(document.querySelector('.tylo-chat-bubble p')?.textContent).toBe('Hello Bob');
    }, { timeout: 10000 });

    expect(apiMock).toHaveBeenCalledWith(
      '/chat/conversations',
      expect.objectContaining({ method: 'POST', body: { peerUserId: 'u-bob' } }),
    );
    expect(apiMock).toHaveBeenCalledWith(
      '/chat/conversations/c-1/messages',
      expect.objectContaining({ method: 'POST', body: { body: 'Hello Bob' } }),
    );
  }, 20000);

  it('homepage compact composer is a full one-liner without send arrow', async () => {
    const user = userEvent.setup();
    render(<InternalChat compact />);

    const peerButton = await screen.findByRole('button', { name: /Bob/i }, { timeout: 10000 });
    await user.click(peerButton);

    const input = await screen.findByLabelText('Type a message', {}, { timeout: 10000 });
    expect(input.tagName).toBe('INPUT');
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(document.querySelector('.tylo-chat-composer--oneline')).toBeTruthy();

    await user.clear(input);
    await user.type(input, 'Hello homepage{Enter}');

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        '/chat/conversations/c-1/messages',
        expect.objectContaining({ method: 'POST', body: { body: 'Hello homepage' } }),
      );
    }, { timeout: 10000 });
  }, 20000);
});
