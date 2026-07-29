import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampsPage from './CampManagePage.jsx';
import { CampWorkingStageProvider } from './CampWorkingStageContext.jsx';

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/camps/manage']}>
      <CampWorkingStageProvider>
        <Routes>
          <Route path="/camps/manage" element={<CampsPage />} />
        </Routes>
      </CampWorkingStageProvider>
    </MemoryRouter>,
  );
}

describe('CampManagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders camps table without crashing', async () => {
    renderPage();
    expect(await screen.findByText('CAMP-001')).toBeTruthy();
  });
});
