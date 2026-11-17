import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampProgramRequestPage from './CampProgramRequestPage.jsx';

const load = vi.fn();
const submit = vi.fn();

vi.mock('./campRequestFormApi.js', () => ({
  campRequestFormApi: {
    load: (...args) => load(...args),
    submit: (...args) => submit(...args),
    downloadSample: vi.fn(),
    uploadData: vi.fn(),
    lookupPin: vi.fn(),
    fetchStates: vi.fn(),
    fetchDistricts: vi.fn(),
    fetchCities: vi.fn(),
    autocompleteAddress: vi.fn(),
  },
}));

vi.mock('../components/CampLifecycleForm.jsx', () => ({
  CampLifecycleForm: ({ lockProgramFields, requestOnly, addressLookup, updateFields }) => (
    <div
      data-testid="request-form"
      data-lock={String(lockProgramFields)}
      data-request-only={String(requestOnly)}
      data-has-lookup={String(Boolean(addressLookup?.autocomplete))}
    >
      <button
        type="button"
        onClick={() => updateFields({
          doctorName: 'Anita Sharma',
          doctorCode: 'D001',
          speciality: 'General Practitioner',
          campDate: '2026-12-15',
          startTime: '10:00',
          endTime: '14:00',
          hq: 'Devanahalli',
          pincode: '560300',
          state: 'Karnataka',
          district: 'Bengaluru Rural',
          zone: 'South Zone',
          city: 'Devanahalli',
          expectedPatients: '40',
          fieldPersonName: 'Ravi Kumar',
          fieldPersonPhone: '9876543210',
          contactPersonLevel: 'Territory Manager',
          contactPersons: [{
            level: 'Territory Manager',
            name: 'Ravi Kumar',
            phone: '9876543210',
          }],
          campAddress: 'Kempegowda International Airport Bengaluru (BLR), KIAL Rd, Devanahalli, Bengaluru, Karnataka, India',
          googlePlaceId: 'ola-platform:airport',
          addressManualEntry: false,
          latitude: '13.05158',
          longitude: '77.61194',
          remarks: 'Public screening camp',
        })}
      >
        Apply selected address
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  load.mockReset();
  submit.mockReset();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/c/token-1']}>
      <Routes>
        <Route path="/c/:token" element={<CampProgramRequestPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampProgramRequestPage', () => {
  beforeEach(() => {
    load.mockResolvedValue({
      clientId: 'c1',
      clientName: 'Acme Health',
      programName: 'Viva BMD',
      campName: 'BMD',
      campDuration: '4:00',
    });
  });

  it('loads the program and shows a locked New Camp request form without bulk upload', async () => {
    renderPage();
    const form = await screen.findByTestId('request-form');
    expect(form.getAttribute('data-lock')).toBe('true');
    expect(form.getAttribute('data-request-only')).toBe('true');
    expect(form.getAttribute('data-has-lookup')).toBe('true');
    expect(screen.getByRole('heading', { name: 'New Camp Request' })).toBeTruthy();
    expect(screen.getByText(/Acme Health · Viva BMD · BMD/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /bulk upload/i })).toBeNull();
    expect(screen.getByAltText('TYLO')).toBeTruthy();
    await waitFor(() => expect(load).toHaveBeenCalledWith('token-1'));
  });

  it('blocks submit when required fields are incomplete', async () => {
    renderPage();
    await screen.findByTestId('request-form');
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    expect(submit).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('submits the selected address with latitude and longitude', async () => {
    submit.mockResolvedValue({ campId: 'C-100', status: 'pending_review' });
    renderPage();
    await screen.findByTestId('request-form');
    fireEvent.click(screen.getByRole('button', { name: /apply selected address/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const payload = submit.mock.calls[0][1];
    expect(submit.mock.calls[0][0]).toBe('token-1');
    expect(payload.campAddress).toMatch(/Kempegowda/);
    expect(payload.googlePlaceId).toBe('ola-platform:airport');
    expect(payload.addressManualEntry).toBe(false);
    expect(payload.latitude).toBe('13.05158');
    expect(payload.longitude).toBe('77.61194');
    expect(payload.pincode).toBe('560300');
    expect(payload.city).toBe('Devanahalli');
    expect(payload.doctorCode).toBe('D001');
    expect(payload.remarks).toBe('Public screening camp');
    expect(payload.source).toBe('program_form');
    expect(await screen.findByText(/Request submitted for Camp One review as C-100/i)).toBeTruthy();
  });
});
