import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CampPipelinePanel, {
  canUsePipelineAdminFilters,
  pipelineTilesFromBoard,
  stageDataFromBoard,
} from './CampPipelinePanel.jsx';

const api = vi.fn();
const listOpsBoardFilters = vi.fn();

vi.mock('../../shared/api.js', () => ({
  api: (...args) => api(...args),
}));

vi.mock('../camps/campOpsApi.js', () => ({
  clientMasterApi: {
    listOpsBoardFilters: (...args) => listOpsBoardFilters(...args),
  },
}));

const MOCK_BOARD = {
  total: 10,
  stages: [
    {
      id: 'request',
      total: 4,
      byStatus: {
        review_pending: 2,
        review_overdue: 1,
        request_rejected: 1,
        information_requested: 0,
      },
      statuses: [],
    },
    {
      id: 'assignment',
      total: 2,
      byStatus: { unassigned: 2, hiring_requested: 0 },
      statuses: [],
    },
    {
      id: 'execution',
      total: 3,
      byStatus: {
        planned: 1,
        executed: 2,
        cancelled_by_tylo: 0,
        cancelled_by_client: 0,
      },
      statuses: [],
    },
    {
      id: 'financial',
      total: 1,
      byStatus: {
        payment_not_checked: 1,
        payment_confirmed: 0,
        payment_hold: 0,
        payment_done: 0,
      },
      statuses: [],
    },
  ],
};

describe('CampPipelinePanel helpers', () => {
  it('gates admin filters by systemRole', () => {
    expect(canUsePipelineAdminFilters({ systemRole: 'Super Admin' })).toBe(true);
    expect(canUsePipelineAdminFilters({ systemRole: 'Admin' })).toBe(true);
    expect(canUsePipelineAdminFilters({ systemRole: 'User' })).toBe(false);
    expect(canUsePipelineAdminFilters({})).toBe(false);
  });

  it('maps board stages into tile counts', () => {
    const data = stageDataFromBoard(MOCK_BOARD);
    expect(data.reviewPending).toBe(2);
    expect(data.requestTotal).toBe(4);
    expect(data.unassigned).toBe(2);
    expect(data.executed).toBe(2);
    expect(data.pendingConfirmation).toBe(1);
  });

  it('builds four Camp One stage tiles with Manage deep-links vocabulary', () => {
    const tiles = pipelineTilesFromBoard(MOCK_BOARD);
    expect(tiles.map((tile) => tile.id)).toEqual(['request', 'assignment', 'execution', 'financial']);
    expect(tiles[0].statuses.map((row) => row.label)).toEqual([
      'Review Pending',
      'Review Overdue',
      'Refusal',
      'Info Requested',
    ]);
    expect(tiles[1].statuses.map((row) => row.label)).toEqual(['Unassigned', 'Hiring Request']);
    expect(tiles[0].statuses[0].count).toBe(2);
    expect(tiles[2].statuses.find((row) => row.value === 'executed')?.count).toBe(2);
  });
});

describe('CampPipelinePanel', () => {
  beforeEach(() => {
    api.mockResolvedValue({ data: MOCK_BOARD });
    listOpsBoardFilters.mockResolvedValue({
      data: {
        methods: ['BMD'],
        assignedUsers: [{ email: 'ops@tylo.test', name: 'Ops User' }],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows Method and Assigned Users for Super Admin, plus date range', async () => {
    render(
      <MemoryRouter>
        <CampPipelinePanel enabled user={{ systemRole: 'Super Admin' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Method')).toBeTruthy();
    expect(screen.getByLabelText('Assigned Users')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Camp pipeline date range' })).toBeTruthy();
    await waitFor(() => {
      expect(api.mock.calls.some(([path]) => String(path).startsWith('/dashboards/camp-pipeline'))).toBe(true);
    });
    expect(listOpsBoardFilters).toHaveBeenCalled();
    expect(await screen.findByText('Review Pending')).toBeTruthy();
    expect(screen.getByText('Refusal')).toBeTruthy();
    expect(screen.getByText('Hiring Request')).toBeTruthy();
    const pendingLink = screen.getByRole('link', { name: /Review Pending/i });
    expect(pendingLink.getAttribute('href')).toContain('stage=request');
    expect(pendingLink.getAttribute('href')).toContain('status=review_pending');
  });

  it('hides Method and Assigned Users for User system role', async () => {
    render(
      <MemoryRouter>
        <CampPipelinePanel enabled user={{ systemRole: 'User' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('group', { name: 'Camp pipeline date range' })).toBeTruthy();
    expect(screen.queryByLabelText('Method')).toBeNull();
    expect(screen.queryByLabelText('Assigned Users')).toBeNull();
    expect(listOpsBoardFilters).not.toHaveBeenCalled();
  });
});
