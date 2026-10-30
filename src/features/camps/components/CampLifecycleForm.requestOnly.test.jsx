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

    const order = [
      'Doctor Name',
      'Doctor Code',
      'Specialty',
      'Camp Date',
      'Start Time',
      'End Time',
      'Camp / Clinic Address',
      'Contact Person Level',
      'Contact Person Name',
      'Contact Person Number',
      'HQ',
      'Expected Patients',
      'Remarks',
    ];
    const positions = order.map((label) => screen.getByText(label, { exact: false }));
    for (let i = 0; i < positions.length - 1; i += 1) {
      expect(
        positions[i].compareDocumentPosition(positions[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    const pairLabels = (left, right) => {
      const row = screen.getByText(left, { exact: false }).closest('.camp-request-pair-row');
      expect(row).toBeTruthy();
      expect(row.contains(screen.getByText(right, { exact: false }))).toBe(true);
    };
    pairLabels('Doctor Name', 'Doctor Code');
    pairLabels('Specialty', 'Camp Date');
    pairLabels('Start Time', 'End Time');
    pairLabels('Contact Person Level', 'Contact Person Name');
    pairLabels('Contact Person Number', 'HQ');
    pairLabels('Expected Patients', 'Remarks');
  });
});
