import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientOneApp from './ClientOneApp.jsx';
import { clearClientOneSession } from './clientOneSession.js';

const login = vi.fn();
const dashboard = vi.fn();
const camps = vi.fn();
const camp = vi.fn();
const logout = vi.fn();
const hcw = vi.fn();
const calendar = vi.fn();
const invoices = vi.fn();
const annexures = vi.fn();
const mis = vi.fn();
const campRequestLink = vi.fn();
const purchaseOrders = vi.fn();

vi.mock('./clientOneApi.js', () => ({
  setClientOneApiMode: vi.fn(),
  getClientOneApiMode: () => 'external',
  clientOneApi: {
    login: (...args) => login(...args),
    dashboard: (...args) => dashboard(...args),
    camps: (...args) => camps(...args),
    camp: (...args) => camp(...args),
    logout: (...args) => logout(...args),
    hcw: (...args) => hcw(...args),
    calendar: (...args) => calendar(...args),
    invoices: (...args) => invoices(...args),
    annexures: (...args) => annexures(...args),
    mis: (...args) => mis(...args),
    campRequestLink: (...args) => campRequestLink(...args),
    purchaseOrders: (...args) => purchaseOrders(...args),
  },
}));

describe('ClientOneApp', () => {
  beforeEach(() => {
    clearClientOneSession();
    login.mockReset();
    dashboard.mockReset();
    camps.mockReset();
    camp.mockReset();
    logout.mockReset();
    campRequestLink.mockReset();
    purchaseOrders.mockReset();
    campRequestLink.mockResolvedValue({ url: 'http://localhost/c/TESTLINK' });
    purchaseOrders.mockResolvedValue([]);
    camps.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    clearClientOneSession();
  });

  it('gates the portal behind a PIN and then shows dashboard KPIs', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      token: 'tok',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      client: { name: 'Acme', programName: 'Oncology', campName: 'BMD', accessId: 'ABC123' },
      features: {
        dashboard: true,
        campTracker: true,
        hcw: true,
        calendar: true,
        invoices: true,
        annexures: true,
        mis: true,
        campRequestLink: true,
        poUpload: true,
      },
    });
    dashboard.mockResolvedValue({
      client: { name: 'Acme', programName: 'Oncology', campName: 'BMD' },
      kpis: {
        total: 3,
        campCount: 3,
        patientsScreened: 120,
        uniqueDoctors: 4,
        approved: 1,
        executed: 1,
        cancelled: 0,
        pending: 1,
        upcoming7Days: 1,
        executionCompletionPct: 50,
        chargeable: 1,
      },
      charts: {},
      leaderboards: { doctors: [], mrs: [] },
    });

    render(
      <MemoryRouter initialEntries={['/client-one']}>
        <Routes>
          <Route path="/client-one" element={<ClientOneApp />} />
          <Route path="/o/:accessId" element={<ClientOneApp />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Client One' })).toBeTruthy();
    await user.type(screen.getByLabelText(/PIN/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Overview' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Camp Register' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Operations Overview' })).toBeTruthy();
      expect(screen.queryByText('OPERATIONS')).toBeNull();
      expect(screen.queryByText(/Health Camp Operations/i)).toBeNull();
      expect(screen.getByText('Total Camps')).toBeTruthy();
      expect(screen.getByText('Patients Screened')).toBeTruthy();
      expect(screen.getByText('Unique Doctors')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0);
    });
  });

  it('opens Power BI drill-down table when clicking a KPI card and returns on back click', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      token: 'tok-drilldown',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      client: { name: 'Acme Health', programName: 'BMD', campName: 'Camp A', accessId: 'DRILL1' },
      features: { dashboard: true, campTracker: true },
    });
    dashboard.mockResolvedValue({
      client: { name: 'Acme Health', programName: 'BMD', campName: 'Camp A' },
      kpis: {
        total: 1,
        campCount: 1,
        patientsScreened: 25,
        uniqueDoctors: 1,
        executed: 1,
        planned: 0,
        cancelled: 0,
      },
      charts: {},
      leaderboards: { doctors: [], mrs: [] },
    });
    camps.mockResolvedValue({
      data: [
        {
          _id: 'camp-101',
          campId: 'CMP-101',
          campDate: '2026-11-05',
          status: 'executed',
          executionStatus: 'executed',
          doctorName: 'Dr. Drilldown',
          city: 'Mumbai',
          state: 'Maharashtra',
          actualPatients: 25,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/client-one']}>
        <Routes>
          <Route path="/client-one" element={<ClientOneApp />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/PIN/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Total Camps')).toBeTruthy();
    });

    // Click the Total Camps KPI card to drill down
    await user.click(screen.getByText('Total Camps'));

    await waitFor(() => {
      expect(screen.getByLabelText('Back to dashboard')).toBeTruthy();
      expect(screen.getByText('CMP-101')).toBeTruthy();
      expect(screen.getByText('Dr. Drilldown')).toBeTruthy();
    });

    // Click Back to Dashboard
    await user.click(screen.getByLabelText('Back to dashboard'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Operations Overview' })).toBeTruthy();
      expect(screen.queryByText('OPERATIONS')).toBeNull();
      expect(screen.queryByText(/Health Camp Operations/i)).toBeNull();
    });
  });
});
