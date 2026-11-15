import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientOneUserBase from './ClientOneUserBase.jsx';

const listMembers = vi.fn();
const createMember = vi.fn();
const updateMember = vi.fn();
const rotateMemberPin = vi.fn();
const geoStates = vi.fn();
const geoCities = vi.fn();

vi.mock('./clientOneApi.js', () => ({
  clientOneApi: {
    listMembers: (...args) => listMembers(...args),
    createMember: (...args) => createMember(...args),
    updateMember: (...args) => updateMember(...args),
    rotateMemberPin: (...args) => rotateMemberPin(...args),
    geoStates: (...args) => geoStates(...args),
    geoCities: (...args) => geoCities(...args),
  },
}));

describe('ClientOneUserBase', () => {
  afterEach(() => {
    cleanup();
    listMembers.mockReset();
    createMember.mockReset();
    updateMember.mockReset();
    rotateMemberPin.mockReset();
    geoStates.mockReset();
    geoCities.mockReset();
  });

  const mockData = {
    tree: [
      {
        id: 'zon1',
        fullName: 'Zonal User',
        mobile: '9999999999',
        designation: 'Zonal',
        level: 'zonal',
        status: 'active',
        regions: ['Maharashtra', 'Gujarat'],
        locations: ['Mumbai', 'Ahmedabad'],
        children: [
          {
            id: 'reg1',
            fullName: 'West Regional',
            mobile: '8888888888',
            designation: 'Regional',
            level: 'regional',
            parentId: 'zon1',
            status: 'active',
            regions: ['Maharashtra'],
            locations: ['Mumbai', 'Pune'],
            children: [
              {
                id: 'area1',
                fullName: 'Pune Area Manager',
                mobile: '7777777777',
                designation: 'Area',
                level: 'area',
                parentId: 'reg1',
                status: 'active',
                regions: ['Maharashtra'],
                locations: ['Pune'],
                children: [],
              },
            ],
          },
        ],
      },
    ],
    members: [
      {
        id: 'zon1',
        fullName: 'Zonal User',
        mobile: '9999999999',
        designation: 'Zonal',
        level: 'zonal',
        status: 'active',
        regions: ['Maharashtra', 'Gujarat'],
        locations: ['Mumbai', 'Ahmedabad'],
      },
      {
        id: 'reg1',
        fullName: 'West Regional',
        mobile: '8888888888',
        designation: 'Regional',
        level: 'regional',
        parentId: 'zon1',
        status: 'active',
        regions: ['Maharashtra'],
        locations: ['Mumbai', 'Pune'],
      },
      {
        id: 'area1',
        fullName: 'Pune Area Manager',
        mobile: '7777777777',
        designation: 'Area',
        level: 'area',
        parentId: 'reg1',
        status: 'active',
        regions: ['Maharashtra'],
        locations: ['Pune'],
      },
    ],
    capabilities: { canManage: true, role: 'programme', maxCreateLevel: 'ho' },
  };

  it('renders organogram nodes and opens detail on click', async () => {
    const user = userEvent.setup();
    listMembers.mockResolvedValue(mockData);
    geoStates.mockResolvedValue([
      { name: 'Maharashtra', code: 'MH' },
      { name: 'Gujarat', code: 'GJ' },
    ]);
    geoCities.mockResolvedValue([
      { name: 'Mumbai', stateName: 'Maharashtra' },
      { name: 'Pune', stateName: 'Maharashtra' },
    ]);

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getAllByText('Zonal User').length).toBeGreaterThan(0);
      expect(screen.getAllByText('West Regional').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: /West Regional/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add Area' })).toBeTruthy();
    });
  });

  it('opens Add user modal with two fields per row', async () => {
    const user = userEvent.setup();
    listMembers.mockResolvedValue(mockData);
    geoStates.mockResolvedValue([
      { name: 'Maharashtra', code: 'MH' },
      { name: 'Gujarat', code: 'GJ' },
    ]);
    geoCities.mockResolvedValue([
      { name: 'Mumbai', stateName: 'Maharashtra' },
      { name: 'Pune', stateName: 'Maharashtra' },
    ]);

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add user' })).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Add user' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add user' })).toBeTruthy();
      // Row 1
      expect(screen.getByPlaceholderText('e.g. Rahul Sharma')).toBeTruthy();
      expect(screen.getByPlaceholderText('10-digit mobile number')).toBeTruthy();
      // Row 2
      expect(screen.getByLabelText('State (Multi-select)')).toBeTruthy();
      expect(screen.getByLabelText('City (Multi-select)')).toBeTruthy();
      // Row 3
      expect(screen.getByLabelText('Designation')).toBeTruthy();
      expect(screen.getByLabelText('Reporting To')).toBeTruthy();
      // Footer actions
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save User' })).toBeTruthy();
    });
  });

  it('dynamically adapts Reporting To based on selected Designation', async () => {
    listMembers.mockResolvedValue(mockData);
    geoStates.mockResolvedValue([{ name: 'Maharashtra' }]);
    geoCities.mockResolvedValue([{ name: 'Mumbai', stateName: 'Maharashtra' }]);

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add user' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add user' })).toBeTruthy();
    });

    const designationSelect = screen.getByLabelText('Designation');
    expect(designationSelect.value).toBe('Zonal');

    // Default designation is Zonal -> Reporting To is disabled with "No reporting parent"
    const reportingSelectZonal = screen.getByLabelText('Reporting To');
    expect(reportingSelectZonal.disabled).toBe(true);
    expect(screen.getByText('No reporting parent')).toBeTruthy();

    // Change to Regional -> Reporting To shows Zonal User
    fireEvent.change(designationSelect, { target: { value: 'Regional' } });
    await waitFor(() => {
      const reportingSelectRegional = screen.getByLabelText('Reporting To');
      expect(reportingSelectRegional.disabled).toBe(false);
      expect(reportingSelectRegional.innerHTML).toContain('Zonal User');
    });

    // Change to Area -> Reporting To shows West Regional
    fireEvent.change(designationSelect, { target: { value: 'Area' } });
    await waitFor(() => {
      const reportingSelectArea = screen.getByLabelText('Reporting To');
      expect(reportingSelectArea.innerHTML).toContain('West Regional');
    });

    // Change to Territory -> Reporting To shows Pune Area Manager
    fireEvent.change(designationSelect, { target: { value: 'Territory' } });
    await waitFor(() => {
      const reportingSelectTerritory = screen.getByLabelText('Reporting To');
      expect(reportingSelectTerritory.innerHTML).toContain('Pune Area Manager');
    });
  });

  it('validates mandatory fields on submit', async () => {
    listMembers.mockResolvedValue(mockData);
    geoStates.mockResolvedValue([{ name: 'Maharashtra' }]);
    geoCities.mockResolvedValue([{ name: 'Mumbai', stateName: 'Maharashtra' }]);

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add user' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeTruthy();
      expect(screen.getByText('Enter a valid 10-digit mobile number')).toBeTruthy();
    });
    expect(createMember).not.toHaveBeenCalled();
  });

  it('submits valid form and reveals generated PIN banner', async () => {
    listMembers.mockResolvedValue(mockData);
    geoStates.mockResolvedValue([{ name: 'Maharashtra' }]);
    geoCities.mockResolvedValue([{ name: 'Mumbai', stateName: 'Maharashtra' }]);
    createMember.mockResolvedValue({
      id: 'new1',
      fullName: 'Aarav Patel',
      mobile: '9123456789',
      designation: 'Zonal',
      level: 'zonal',
      pin: '654321',
    });

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add user' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));

    const nameInput = screen.getByPlaceholderText('e.g. Rahul Sharma');
    const mobileInput = screen.getByPlaceholderText('10-digit mobile number');

    fireEvent.change(nameInput, { target: { value: 'Aarav Patel' } });
    fireEvent.change(mobileInput, { target: { value: '9123456789' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    await waitFor(() => {
      expect(createMember).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Aarav Patel',
          mobile: '9123456789',
          designation: 'Zonal',
          level: 'zonal',
          parentId: null,
        }),
      );
      expect(screen.getByText('SECURE ACCESS PIN')).toBeTruthy();
      expect(screen.getByText('654321')).toBeTruthy();
    });
  });

  it('supports Edit mode and pre-populates existing user fields', async () => {
    const user = userEvent.setup();
    listMembers.mockResolvedValue(mockData);
    geoStates.mockResolvedValue([{ name: 'Maharashtra' }]);
    geoCities.mockResolvedValue([{ name: 'Mumbai', stateName: 'Maharashtra' }]);
    updateMember.mockResolvedValue({
      id: 'reg1',
      fullName: 'West Regional Updated',
      mobile: '8888888888',
      designation: 'Regional',
      level: 'regional',
      parentId: 'zon1',
    });

    render(<ClientOneUserBase dateControls={null} />);

    await waitFor(() => {
      expect(screen.getAllByText('West Regional').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: /West Regional/ }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit user' })).toBeTruthy();
      const nameInput = screen.getByPlaceholderText('e.g. Rahul Sharma');
      expect(nameInput.value).toBe('West Regional');
      const mobileInput = screen.getByPlaceholderText('10-digit mobile number');
      expect(mobileInput.value).toBe('8888888888');
    });

    const nameInput = screen.getByPlaceholderText('e.g. Rahul Sharma');
    fireEvent.change(nameInput, { target: { value: 'West Regional Updated' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateMember).toHaveBeenCalledWith(
        'reg1',
        expect.objectContaining({
          fullName: 'West Regional Updated',
          mobile: '8888888888',
          designation: 'Regional',
          level: 'regional',
          parentId: 'zon1',
        }),
      );
    });
  });
});
