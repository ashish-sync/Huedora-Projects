import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampExecutionRowActions } from './CampExecutionRowActions.jsx';

vi.mock('../utils/campAssignmentCopy', () => ({
  copyCampAssignmentDetailsFromRecord: vi.fn().mockResolvedValue(true),
}));

const baseCamp = {
  _id: 'camp-1',
  status: 'approved',
  assignmentStatus: 'Assigned',
  lifecycleStage: 'execution',
  executionStatus: 'Ongoing',
  chargeableStatus: 'Chargeable',
  inTime: '09:05',
  attire: 'No Issues',
  campDate: '2000-01-01',
  startTime: '09:00',
  hcwName: 'Ravi',
  hcwContact: '9999999999',
};

function renderActions(overrides = {}) {
  return render(
    <MemoryRouter>
      <CampExecutionRowActions
        camp={{ ...baseCamp, ...overrides }}
        canEdit
        canRejectCamps
        hasPermission={() => true}
        onAction={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('CampExecutionRowActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders copy details instead of mark executed', () => {
    renderActions();
    expect(screen.getByLabelText('Copy details')).toBeTruthy();
    expect(screen.queryByLabelText('Mark executed')).toBeNull();
    expect(screen.getByLabelText('Edit camp')).toBeTruthy();
  });

  it('hides copy details when camp is not assigned', () => {
    renderActions({ assignmentStatus: 'Pending', hcwName: '', hcwContact: '' });
    expect(screen.queryByLabelText('Copy details')).toBeNull();
    expect(screen.getByLabelText('Edit camp')).toBeTruthy();
  });
});
