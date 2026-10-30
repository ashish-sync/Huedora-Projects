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
  clientMasterApi: {
    listOpsBoardFilters: vi.fn(async () => ({
      data: {
        methods: ['BMD'],
        divisionsByMethod: { BMD: ['Oncology'] },
        clientsByMethod: { BMD: [{ _id: 'client-1', name: 'Acme' }] },
        clientsByMethodDivision: {
          BMD: { Oncology: [{ _id: 'client-1', name: 'Acme' }] },
        },
        assignedUsers: [{ email: 'ops@tylo.test', name: 'Ops User' }],
      },
    })),
  },
}));

vi.mock('./CampClientTypeahead.jsx', () => ({
  CampClientTypeahead: ({ value, onChange, disabled }) => (
    <select
      aria-label="Client Name"
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        onChange(next, next ? { _id: next, name: 'Acme' } : null);
      }}
    >
      <option value="">All clients</option>
      <option value="client-1">Acme</option>
    </select>
  ),
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

  it('renders Method, Division / Therapy, Client Name, then Assigned Users next to Total Camps', async () => {
    renderBoard();
    await screen.findByText('14');
    const method = screen.getByText('Method');
    const division = screen.getByText('Division / Therapy');
    const client = screen.getByText('Client Name');
    const assigned = screen.getByText('Assigned Users');
    expect(method.compareDocumentPosition(division) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(division.compareDocumentPosition(client) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(client.compareDocumentPosition(assigned) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('Client Name')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Method').disabled).toBe(false);
      expect(screen.getByLabelText('Assigned Users').disabled).toBe(false);
    });
    expect(screen.getByLabelText('Division / Therapy').disabled).toBe(true);
    expect(screen.getByLabelText('Client Name').disabled).toBe(true);
  });

  it('filters Method first, then Division, then Client Name, with Assigned Users independent', async () => {
    renderBoard();
    await screen.findByText('14');

    await waitFor(() => {
      expect(screen.getByLabelText('Method').disabled).toBe(false);
      expect(screen.getByLabelText('Assigned Users').disabled).toBe(false);
    });
    expect(screen.getByRole('option', { name: 'Ops User · ops@tylo.test' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Assigned Users'), { target: { value: 'ops@tylo.test' } });

    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'BMD' } });
    await waitFor(() => {
      expect(screen.getByLabelText('Division / Therapy').disabled).toBe(false);
      expect(screen.getByLabelText('Client Name').disabled).toBe(false);
    });
    fireEvent.change(screen.getByLabelText('Division / Therapy'), { target: { value: 'Oncology' } });
    fireEvent.change(screen.getByLabelText('Client Name'), { target: { value: 'client-1' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Assigned Users').value).toBe('ops@tylo.test');
    });

    await waitFor(() => {
      const last = dashboardApi.operations.mock.calls.at(-1)?.[0];
      expect(last).toMatchObject({
        client: 'client-1',
        campaignType: 'Oncology',
        campaign: 'BMD',
        assignedUser: 'ops@tylo.test',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-29',
      });
    });

    const total = screen.getByRole('link', { name: /Total Camps/i });
    expect(total.getAttribute('href')).toContain('client=client-1');
    expect(total.getAttribute('href')).toContain('campaignType=Oncology');
    expect(total.getAttribute('href')).toContain('campaign=BMD');
    expect(total.getAttribute('href')).toContain('assignedUser=ops%40tylo.test');

    const section = screen.getByRole('link', { name: /Review Pending/i });
    expect(section.getAttribute('href')).toContain('/camp-one/manage');
    expect(section.getAttribute('href')).toContain('client=client-1');
    expect(section.getAttribute('href')).toContain('campaignType=Oncology');
    expect(section.getAttribute('href')).toContain('campaign=BMD');
    expect(section.getAttribute('href')).toContain('assignedUser=ops%40tylo.test');

    const openInManage = screen.getAllByRole('link', { name: /Open in Manage/i });
    expect(openInManage[0].getAttribute('href')).toContain('client=client-1');
    expect(openInManage[0].getAttribute('href')).toContain('campaignType=Oncology');
    expect(openInManage[0].getAttribute('href')).toContain('campaign=BMD');
    expect(openInManage[0].getAttribute('href')).toContain('assignedUser=ops%40tylo.test');

    fireEvent.click(screen.getByRole('button', { name: 'Download Review Pending camps' }));
    await waitFor(() => {
      expect(campApi.downloadListExport).toHaveBeenCalled();
    });
    const [path] = campApi.downloadListExport.mock.calls.at(-1);
    const url = new URL(path, 'http://local.test');
    expect(url.searchParams.get('client')).toBe('client-1');
    expect(url.searchParams.get('campaignType')).toBe('Oncology');
    expect(url.searchParams.get('campaign')).toBe('BMD');
    expect(url.searchParams.get('assignedUser')).toBe('ops@tylo.test');
  });
});
