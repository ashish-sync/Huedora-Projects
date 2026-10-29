import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CampOperationsBoard from './CampOperationsBoard.jsx';
import { campApi, dashboardApi } from '../campOpsApi.js';

vi.mock('../campOpsApi.js', () => ({
  dashboardApi: {
    operations: vi.fn(),
  },
  campApi: {
    downloadListExport: vi.fn(async () => {}),
  },
}));

const SECTIONS = [
  ['request', 'review_pending', 'Review Pending'],
  ['request', 'review_overdue', 'Review Overdue'],
  ['request', 'request_rejected', 'Refused'],
  ['request', 'information_requested', 'Info Requested'],
  ['assignment', 'unassigned', 'Unassigned'],
  ['assignment', 'hiring_requested', 'Hiring Requested'],
  ['execution', 'planned', 'Planned'],
  ['execution', 'executed', 'Executed'],
  ['execution', 'cancelled_by_tylo', 'Cancelled by Tylo'],
  ['execution', 'cancelled_by_client', 'Cancelled by Client'],
  ['financial', 'payment_not_checked', 'Pending Confirmation'],
  ['financial', 'payment_confirmed', 'Confirmed Payment'],
  ['financial', 'payment_hold', 'Hold'],
  ['financial', 'payment_done', 'Payment Done'],
];

const BOARD = {
  total: 14,
  stages: [
    {
      id: 'request',
      label: 'Request',
      total: 4,
      statuses: SECTIONS.filter(([stage]) => stage === 'request').map(([, value, label]) => ({
        value,
        label,
        count: 2,
      })),
    },
    {
      id: 'assignment',
      label: 'Assignment',
      total: 2,
      statuses: SECTIONS.filter(([stage]) => stage === 'assignment').map(([, value, label]) => ({
        value,
        label,
        count: 2,
      })),
    },
    {
      id: 'execution',
      label: 'Execution',
      total: 4,
      statuses: SECTIONS.filter(([stage]) => stage === 'execution').map(([, value, label]) => ({
        value,
        label,
        count: 2,
      })),
    },
    {
      id: 'financial',
      label: 'Financial',
      total: 4,
      statuses: SECTIONS.filter(([stage]) => stage === 'financial').map(([, value, label]) => ({
        value,
        label,
        count: value === 'payment_done' ? 0 : 2,
      })),
    },
  ],
};

function renderBoard() {
  return render(
    <MemoryRouter>
      <CampOperationsBoard embedded initialFrom="2026-10-01" initialTo="2026-10-29" />
    </MemoryRouter>,
  );
}

describe('CampOperationsBoard export', () => {
  beforeEach(() => {
    dashboardApi.operations.mockResolvedValue({ data: BOARD });
    campApi.downloadListExport.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('adds a download control to all 14 board sections', async () => {
    renderBoard();
    expect(SECTIONS).toHaveLength(14);
    for (const [, , label] of SECTIONS) {
      expect(await screen.findByRole('button', { name: `Download ${label} camps` })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Download Payment Done camps' }).disabled).toBe(true);
  });

  it('downloads the section without opening a preview list', async () => {
    renderBoard();
    fireEvent.click(await screen.findByRole('button', { name: 'Download Review Pending camps' }));
    await waitFor(() => {
      expect(campApi.downloadListExport).toHaveBeenCalledTimes(1);
    });
    const [path, filename] = campApi.downloadListExport.mock.calls[0];
    const url = new URL(path, 'http://local.test');
    expect(url.pathname).toBe('/camp-ops/camps/export');
    expect(url.searchParams.get('requestReviewStatus')).toBe('review_pending');
    expect(url.searchParams.get('dateFrom')).toBe('2026-10-01');
    expect(url.searchParams.get('dateTo')).toBe('2026-10-29');
    expect(filename).toBe('Camp_One_Request_Review_Pending.xlsx');
    expect(screen.queryByLabelText('Camp pivot list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download Excel' })).toBeNull();
  });

  it('opens section counts in Manage instead of a split-screen preview', async () => {
    renderBoard();
    const section = await screen.findByRole('link', { name: /Review Pending/i });
    expect(section.getAttribute('href')).toContain('/camp-one/manage');
    expect(section.getAttribute('href')).toContain('stage=request');
    expect(section.getAttribute('href')).toContain('status=review_pending');
    expect(section.getAttribute('href')).toContain('dateFrom=2026-10-01');
  });
});
