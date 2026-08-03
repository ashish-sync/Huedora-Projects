import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampsPage from './CampManagePage.jsx';
import { EXECUTION_STATUS } from './constants/campLifecycle.js';

vi.mock('./useCampOpsAuth.js', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    isSuperAdmin: () => true,
    canApproveCamps: () => true,
    canRejectCamps: () => true,
    canEditCampRecord: () => true,
  }),
}));

vi.mock('./CampWorkingStageContext.jsx', () => ({
  CampWorkingStageProvider: ({ children }) => children,
  useCampWorkingStage: () => ({
    workingStage: 'execution',
    workingStageMeta: { id: 'execution', label: 'Camp Execution', short: 'Execution' },
    setWorkingStage: vi.fn(),
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
            doctorName: 'Dr. Rao',
            status: 'approved',
            lifecycleStage: 'execution',
            assignmentStatus: 'Assigned',
            executionStatus: 'Ongoing',
            // Future date so effective status stays scheduled in badge logic
            campDate: '2099-08-01',
            startTime: '09:00',
            endTime: '12:00',
          },
        ],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    }),
    bulkAction: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../../shared/api.js', () => ({
  api: vi.fn().mockResolvedValue({ data: [] }),
}));

function renderExecutionManagePage() {
  return render(
    <MemoryRouter initialEntries={['/camps/manage']}>
      <Routes>
        <Route path="/camps/manage" element={<CampsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampManagePage execution stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders execution stage table and row actions without crashing', async () => {
    renderExecutionManagePage();
    expect(await screen.findByText('Demo')).toBeTruthy();
    expect(screen.getByLabelText('Mark executed')).toBeTruthy();
    expect(screen.getByTitle(EXECUTION_STATUS.CAMP_SCHEDULED)).toBeTruthy();
  });
});
