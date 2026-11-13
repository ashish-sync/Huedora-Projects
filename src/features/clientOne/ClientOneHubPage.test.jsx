import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ClientOneHubPage from './ClientOneHubPage.jsx';

const list = vi.fn();
const previewClientOne = vi.fn();

vi.mock('../camps/campOpsApi.js', () => ({
  clientMasterApi: {
    list: (...args) => list(...args),
    previewClientOne: (...args) => previewClientOne(...args),
  },
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('ClientOneHubPage', () => {
  beforeEach(() => {
    list.mockReset();
    previewClientOne.mockReset();
    navigate.mockReset();
    list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'm1',
            clientName: 'Acme',
            programName: 'Oncology',
            campName: 'BMD',
            isActive: true,
          },
        ],
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('lists programmes and opens an internal preview session', async () => {
    const user = userEvent.setup();
    // Real campOpsApi asAxios shape: server `{ data: session }` becomes `res.data.data`.
    previewClientOne.mockResolvedValue({
      data: {
        data: {
          token: 'preview-tok',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          mode: 'preview',
          client: {
            name: 'Acme',
            programName: 'Oncology',
            campName: 'BMD',
            clientMasterId: 'm1',
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <ClientOneHubPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Preview portal' }));

    await waitFor(() => {
      expect(previewClientOne).toHaveBeenCalledWith('m1');
      expect(navigate).toHaveBeenCalledWith('/client-one/preview/m1');
    });
  });
});
