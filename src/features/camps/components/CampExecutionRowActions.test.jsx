import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampExecutionRowActions } from './CampExecutionRowActions.jsx';

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
};

function renderActions(overrides = {}) {
  return render(
    <MemoryRouter>
      <CampExecutionRowActions
        camp={{ ...baseCamp, ...overrides }}
        canEdit
        canExecute
        canRejectCamps
        hasPermission={() => true}
        onExecute={vi.fn()}
        onAction={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('CampExecutionRowActions', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders execution row actions without runtime errors', () => {
    renderActions();
    expect(screen.getByLabelText('Mark executed')).toBeTruthy();
    expect(screen.getByLabelText('Edit camp')).toBeTruthy();
  });

  it('greys out mark executed until required execution fields are filled', () => {
    renderActions({ chargeableStatus: '', inTime: '', attire: '' });
    expect(screen.getByLabelText('Cannot mark executed yet').disabled).toBe(true);
    expect(screen.getByLabelText('View execution issues')).toBeTruthy();
  });

  it('shows issues action when execution is blocked', () => {
    renderActions({ assignmentStatus: 'Pending', chargeableStatus: '', inTime: '', attire: '' });
    expect(screen.getByLabelText('View execution issues')).toBeTruthy();
    expect(screen.getByLabelText('Cannot mark executed yet').disabled).toBe(true);
  });
});
