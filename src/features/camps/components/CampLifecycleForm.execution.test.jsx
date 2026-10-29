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

function renderExecutionForm(overrides = {}, formProps = {}) {
  const form = {
    ...emptyLifecycleForm(),
    campDate: '2099-08-01',
    startTime: '09:00',
    endTime: '12:00',
    durationHours: 3,
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
      {...formProps}
    />,
  );
}

describe('CampLifecycleForm execution stage', () => {
  afterEach(() => cleanup());

  it('renders execution fields with consumables section', async () => {
    renderExecutionForm();
    expect(screen.getByDisplayValue('Planned')).toBeTruthy();
    expect(screen.getByText('Chargeable Status')).toBeTruthy();
    expect(screen.getByText('In Time')).toBeTruthy();
    expect(screen.getByText('Execution Documents')).toBeTruthy();
    expect(screen.getByText('Doctor Form (DF)')).toBeTruthy();
    expect(screen.getByText('Patient Form (PF)')).toBeTruthy();
    expect(screen.getByText('GPS Selfie (GS)')).toBeTruthy();
    expect(screen.getByText('GPS Selfie Out (GO)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Other document type')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Upload' }).length).toBe(5);
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

  it('lets Admin edit Execution Status after Finance', async () => {
    render(
      <CampLifecycleForm
        form={{
          ...emptyLifecycleForm(),
          campDate: '2099-08-01',
          startTime: '09:00',
          endTime: '12:00',
          lifecycleStage: 'financial',
          executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
          submittedToFinanceAt: '2026-10-01T00:00:00.000Z',
          consumablesUsed: [],
        }}
        updateField={vi.fn()}
        updateFields={vi.fn()}
        activeStage="execution"
        onStageChange={vi.fn()}
        campStatus="executed"
        reachedLifecycleStage="financial"
        campId="camp-1"
        onUploadDocuments={vi.fn()}
        isAdmin
        stageReadOnly={{ execution: false }}
      />,
    );
    const status = screen.getByLabelText('Execution Status');
    expect(status).toBeTruthy();
    expect(status.disabled).toBe(false);
    expect(status.value).toBe(EXECUTION_STATUS.MARKED_EXECUTED);
    expect(screen.getByText(/after Finance/i)).toBeTruthy();
    expect(await screen.findByText('Consumables Tracking')).toBeTruthy();
  });

  it('recomputes Extra hours on an existing camp from the Client Master snapshot', async () => {
    renderExecutionForm({
      inTime: '09:00',
      outTime: '15:00',
      durationHours: 3,
      extraHours: 3,
      clientMasterCampDuration: '4:00',
    });
    expect(screen.getByLabelText('Total Hours').value).toBe('6');
    expect(screen.getByLabelText('Extra hours').value).toBe('2');
    expect(await screen.findByText('Consumables Tracking')).toBeTruthy();
  });

  it('shows Extra hours as Total Hours minus Client Master camp duration', async () => {
    renderExecutionForm(
      { inTime: '09:00', outTime: '15:00', durationHours: 3 },
      {
        clientMasterRecords: [{
          campDuration: '4:00',
          isActive: true,
          executedCampUnit: 0,
          otUnit: 0,
        }],
      },
    );
    expect(screen.getByLabelText('Total Hours').value).toBe('6');
    expect(screen.getByLabelText('Extra hours').value).toBe('2');
    expect(await screen.findByText('Consumables Tracking')).toBeTruthy();
  });

  it('locks Camp, Travel, and Overtime payouts when cancelled by Tylo or Client', () => {
    render(
      <CampLifecycleForm
        form={{
          ...emptyLifecycleForm(),
          campDate: '2099-08-01',
          startTime: '09:00',
          endTime: '12:00',
          lifecycleStage: 'financial',
          executionStatus: 'Cancelled by Client',
          campAmount: 0,
          travelling: 0,
          overtimeExpense: 0,
          otherExpenses: 0,
        }}
        updateField={vi.fn()}
        updateFields={vi.fn()}
        activeStage="financial"
        onStageChange={vi.fn()}
        campStatus="cancelled"
        reachedLifecycleStage="financial"
        campId="camp-1"
      />,
    );
    expect(screen.getByLabelText('Camp Payout').disabled).toBe(true);
    expect(screen.getByLabelText('Travel Payout').disabled).toBe(true);
    expect(screen.getByLabelText('Overtime Payout').disabled).toBe(true);
    expect(screen.getByLabelText('Other Payouts').disabled).toBe(false);
  });

  it('keeps all payout fields editable for executed camps', () => {
    render(
      <CampLifecycleForm
        form={{
          ...emptyLifecycleForm(),
          campDate: '2099-08-01',
          startTime: '09:00',
          endTime: '12:00',
          lifecycleStage: 'financial',
          executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
          campAmount: 1800,
          travelling: 200,
          overtimeExpense: 100,
          otherExpenses: 50,
        }}
        updateField={vi.fn()}
        updateFields={vi.fn()}
        activeStage="financial"
        onStageChange={vi.fn()}
        campStatus="executed"
        reachedLifecycleStage="financial"
        campId="camp-1"
      />,
    );
    expect(screen.getByLabelText('Camp Payout').disabled).toBe(false);
    expect(screen.getByLabelText('Travel Payout').disabled).toBe(false);
    expect(screen.getByLabelText('Overtime Payout').disabled).toBe(false);
    expect(screen.getByLabelText('Other Payouts').disabled).toBe(false);
  });
});
