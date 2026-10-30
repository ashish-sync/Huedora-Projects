import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampLifecycleForm } from './CampLifecycleForm.jsx';
import { emptyLifecycleForm } from '../constants/campLifecycle.js';

vi.mock('./CampLocationFields.jsx', () => ({ default: () => <div data-testid="location-fields" /> }));
vi.mock('./CampAddressField.jsx', () => ({ default: () => <div data-testid="address-field" /> }));
vi.mock('./CampNameSelect', () => ({
  CampNameSelect: ({ value, disabled }) => (
    <select aria-label="Method" value={value} disabled={disabled} readOnly>
      <option value={value}>{value}</option>
    </select>
  ),
}));
vi.mock('./CampAssignmentStage.jsx', () => ({
  CampAssignmentStage: () => <div data-testid="assignment-stage" />,
}));
vi.mock('../../../shared/usePicklistOptions.js', () => ({
  usePicklistOptions: () => ({ options: [] }),
}));
vi.mock('../campOpsApi.js', () => ({
  campApi: {
    consumableOptions: vi.fn().mockResolvedValue({ data: { data: [] } }),
    consumablesForCamp: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

afterEach(() => {
  cleanup();
});

describe('CampLifecycleForm program request mode', () => {
  it('hides the lifecycle stepper and program identity fields', () => {
    const form = {
      ...emptyLifecycleForm(),
      source: 'program_form',
      clientId: 'client-1',
      clientName: 'Acme Health',
      campaignType: 'Viva BMD',
      campaignName: 'BMD',
    };

    render(
      <CampLifecycleForm
        form={form}
        updateField={vi.fn()}
        updateFields={vi.fn()}
        activeStage="request"
        onStageChange={vi.fn()}
        campStatus="pending_review"
        divisionOptions={['Viva BMD']}
        campNameOptions={['BMD']}
        reachedLifecycleStage="request"
        requestOnly
        lockProgramFields
      />,
    );

    expect(screen.queryByText('Request Stage')).toBeNull();
    expect(screen.queryByText('Resource Assignment')).toBeNull();
    expect(screen.queryByText('Source of Request')).toBeNull();
    expect(screen.queryByText('Client Name')).toBeNull();
    expect(screen.queryByText('Division / Therapy')).toBeNull();
    expect(screen.queryByText('Method')).toBeNull();
    expect(screen.queryByText('Request Date')).toBeNull();
    expect(screen.queryByText('Camp Duration')).toBeNull();
    expect(screen.queryByText('Camp Slot')).toBeNull();
    expect(screen.getByText('Doctor Name').compareDocumentPosition(screen.getByText('Camp Date'))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Camp Date')).toBeTruthy();
    expect(screen.getByText('Start Time')).toBeTruthy();
    expect(screen.getByText('End Time')).toBeTruthy();
    expect(screen.queryByText('Camp Start Time')).toBeNull();
    expect(screen.queryByText('Camp End Time')).toBeNull();
    expect(screen.queryByTestId('location-fields')).toBeNull();
  });
});
