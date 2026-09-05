import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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
      expect(lastParams.lifecycleStage).toBe('execution');
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
});
