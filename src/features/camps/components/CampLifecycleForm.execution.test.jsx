import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampLifecycleForm } from './CampLifecycleForm.jsx';
import { emptyLifecycleForm, EXECUTION_STATUS } from '../constants/campLifecycle.js';

vi.mock('./CampLocationFields.jsx', () => ({ default: () => <div data-testid="location-fields" /> }));
vi.mock('./CampAddressField.jsx', () => ({ default: () => <div data-testid="address-field" /> }));
vi.mock('./CampAssignmentStage.jsx', () => ({
  CampAssignmentStage: () => <div data-testid="assignment-stage" />,
}));
vi.mock('../../../shared/usePicklistOptions.js', () => ({
  usePicklistOptions: () => ({ options: [] }),
}));
vi.mock('../campOpsApi.js', () => ({
  campApi: {
    consumableOptions: vi.fn().mockResolvedValue({
      data: { data: [{ id: 'p1', name: 'Test Strip', unit: 'Strip', uomId: 'u1' }] },
    }),
    consumablesForCamp: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

function renderExecutionForm(overrides = {}) {
  const form = {
    ...emptyLifecycleForm(),
    campDate: '2099-08-01',
    startTime: '09:00',
    endTime: '12:00',
    lifecycleStage: 'execution',
    executionStatus: EXECUTION_STATUS.CAMP_SCHEDULED,
    consumablesUsed: [],
    ...overrides,
  };

  return render(
    <CampLifecycleForm
      form={form}
      updateField={vi.fn()}
      updateFields={vi.fn()}
      activeStage="execution"
      onStageChange={vi.fn()}
      campStatus="approved"
      reachedLifecycleStage="execution"
      campId="camp-1"
      onUploadDocuments={vi.fn()}
    />,
  );
}

describe('CampLifecycleForm execution stage', () => {
  afterEach(() => cleanup());

  it('renders execution fields with consumables section', async () => {
    renderExecutionForm();
    expect(screen.getByDisplayValue(EXECUTION_STATUS.CAMP_SCHEDULED)).toBeTruthy();
    expect(screen.getByText('Chargeable Status')).toBeTruthy();
    expect(screen.getByText('In Time')).toBeTruthy();
    expect(screen.getByText('Execution Documents')).toBeTruthy();
    expect(screen.getByText('Doctor Form (DF)')).toBeTruthy();
    expect(screen.getByText('Patient Form (PF)')).toBeTruthy();
    expect(screen.getByText('GPS Selfie (GS)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Specify document type/name')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Upload' }).length).toBe(4);
    expect(await screen.findByText('Consumables Tracking')).toBeTruthy();
  });

  it('renders execution panel when active stage uses lifecycle label', async () => {
    renderExecutionForm();
    cleanup();
    render(
      <CampLifecycleForm
        form={{
          ...emptyLifecycleForm(),
          campDate: '2099-08-01',
          startTime: '09:00',
          endTime: '12:00',
          lifecycleStage: 'execution',
          executionStatus: EXECUTION_STATUS.CAMP_SCHEDULED,
          consumablesUsed: [],
        }}
        updateField={vi.fn()}
        updateFields={vi.fn()}
        activeStage="Camp Execution"
        onStageChange={vi.fn()}
        campStatus="approved"
        reachedLifecycleStage="execution"
        campId="camp-1"
        onUploadDocuments={vi.fn()}
      />,
    );
    expect(screen.getByText('Chargeable Status')).toBeTruthy();
    expect(await screen.findByText('Consumables Tracking')).toBeTruthy();
  });
});
