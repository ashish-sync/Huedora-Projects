import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import CampsPage from './CampManagePage.jsx';
import { CampWorkingStageProvider, useCampWorkingStage } from './CampWorkingStageContext.jsx';
import { campApi } from './campOpsApi.js';

vi.mock('./useCampOpsAuth.js', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    isSuperAdmin: () => true,
    canApproveCamps: () => true,
    canRejectCamps: () => true,
    canEditCampRecord: () => true,
  }),
}));

vi.mock('./campOpsApi.js', () => ({
  campApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            _id: '1',
            campId: 'CAMP-001',
            clientName: 'Demo',
            status: 'pending_review',
            lifecycleStage: 'request',
          },
        ],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    }),
    bulkAction: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}));

vi.mock('../../shared/api.js', () => ({
  api: vi.fn().mockResolvedValue({ data: [] }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function StageProbe() {
  const { workingStage, setWorkingStage } = useCampWorkingStage();
  return (
    <div>
      <div data-testid="working-stage">{workingStage}</div>
      <button type="button" onClick={() => setWorkingStage('execution')}>
        Switch to execution
      </button>
      <button type="button" onClick={() => setWorkingStage('financial')}>
        Switch to financial
      </button>
    </div>
  );
}

function renderPage(initialEntry = '/camp-one/manage') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CampWorkingStageProvider>
        <StageProbe />
        <LocationProbe />
        <Routes>
          <Route path="/camp-one/manage" element={<CampsPage />} />
        </Routes>
      </CampWorkingStageProvider>
    </MemoryRouter>,
  );
}

describe('CampManagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders camps table without crashing', async () => {
    renderPage();
    expect(await screen.findByText('Demo')).toBeTruthy();
  });

  it('keeps Working view stage switch when URL already has stage (filter persistence)', async () => {
    const user = userEvent.setup();
    const view = renderPage('/camp-one/manage?stage=request');

    expect(await screen.findByText('Demo')).toBeTruthy();
    expect(view.getByTestId('working-stage').textContent).toBe('request');

    await user.click(view.getByRole('button', { name: 'Switch to execution' }));

    await waitFor(() => {
      expect(view.getByTestId('working-stage').textContent).toBe('execution');
    });
    await waitFor(() => {
      expect(view.getByTestId('location-search').textContent).toContain('stage=execution');
    });
    await waitFor(() => {
      const calls = campApi.list.mock.calls;
      const lastParams = calls[calls.length - 1]?.[0] || {};
      // Execution stage totals use boardStage (active execution + cancelled closures).
      expect(lastParams.boardStage).toBe('execution');
      expect(lastParams.lifecycleStage).toBeUndefined();
    });

    // Stay on the next stage after URL sync (regression for stale ?stage= snap-back).
    await user.click(view.getByRole('button', { name: 'Switch to financial' }));
    await waitFor(() => {
      expect(view.getByTestId('working-stage').textContent).toBe('financial');
    });
    await waitFor(() => {
      expect(view.getByTestId('location-search').textContent).toContain('stage=financial');
    });
  });

  it('keeps date filters after campOps:refreshList focus reload', async () => {
    renderPage('/camp-one/manage?dateFrom=2026-09-01&dateTo=2026-09-28');
    expect(await screen.findByText('Demo')).toBeTruthy();

    await waitFor(() => {
      const calls = campApi.list.mock.calls;
      const withDates = calls.find((c) => c[0]?.dateFrom === '2026-09-01' && c[0]?.dateTo === '2026-09-28');
      expect(withDates).toBeTruthy();
    });

    const before = campApi.list.mock.calls.length;
    sessionStorage.setItem('campOps:refreshList', '1');
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(campApi.list.mock.calls.length).toBeGreaterThan(before);
      const lastParams = campApi.list.mock.calls[campApi.list.mock.calls.length - 1]?.[0] || {};
      expect(lastParams.dateFrom).toBe('2026-09-01');
      expect(lastParams.dateTo).toBe('2026-09-28');
    });
  });

  it('keeps a single Manage history entry so Back returns to Operations Dashboard', async () => {
    const user = userEvent.setup();
    const returnTo = '/dashboard?tab=drilldown&module=camps&from=2026-10-01&to=2026-10-31&preset=month';
    const manage = `/camp-one/manage?stage=execution&status=planned&dateFrom=2026-10-01&dateTo=2026-10-31&returnTo=${encodeURIComponent(returnTo)}`;

    function HistoryProbe() {
      const navigate = useNavigate();
      const location = useLocation();
      return (
        <>
          <div data-testid="full-path">{`${location.pathname}${location.search}`}</div>
          <button type="button" onClick={() => navigate(-1)}>Go back</button>
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={[returnTo, manage]}>
        <CampWorkingStageProvider initialStage="execution">
          <HistoryProbe />
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/camp-one/manage" element={<CampsPage />} />
          </Routes>
        </CampWorkingStageProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Demo')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('full-path').textContent).toContain('/camp-one/manage');
      expect(screen.getByTestId('full-path').textContent).toContain('returnTo=');
    });

    await user.click(screen.getByRole('button', { name: 'Go back' }));
    await waitFor(() => {
      expect(screen.getByTestId('full-path').textContent).toContain('/dashboard');
      expect(screen.getByTestId('full-path').textContent).toContain('tab=drilldown');
      expect(screen.getByTestId('full-path').textContent).toContain('module=camps');
      expect(screen.getByTestId('full-path').textContent).toContain('from=2026-10-01');
    });
  });
});
