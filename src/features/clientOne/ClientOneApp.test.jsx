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
    await user.type(screen.getByLabelText('PIN'), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Camp Tracker' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy();
      expect(screen.getByText('Camp Count')).toBeTruthy();
      expect(screen.getByText('Patients Screened')).toBeTruthy();
      expect(screen.getByText('Unique Doctor')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText(/Acme/)).toBeTruthy();
    });
  });
});
