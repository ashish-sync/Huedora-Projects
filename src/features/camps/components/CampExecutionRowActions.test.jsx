import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampExecutionRowActions } from './CampExecutionRowActions.jsx';

const baseCamp = {
  _id: 'camp-1',
  status: 'approved',
  assignmentStatus: 'Assigned',
  lifecycleStage: 'execution',
  executionStatus: 'Ongoing',
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
  it('renders execution row actions without runtime errors', () => {
    renderActions();
    expect(screen.getByLabelText('Mark executed')).toBeTruthy();
    expect(screen.getByLabelText('Edit camp')).toBeTruthy();
  });

  it('shows issues action when execution is blocked', () => {
    renderActions({ assignmentStatus: 'Pending' });
    expect(screen.getByLabelText('View execution issues')).toBeTruthy();
    expect(screen.getByLabelText('Cannot mark executed yet').disabled).toBe(true);
  });
});
