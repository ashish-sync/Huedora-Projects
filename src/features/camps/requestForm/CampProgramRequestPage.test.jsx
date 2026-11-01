import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampProgramRequestPage from './CampProgramRequestPage.jsx';

const load = vi.fn();
const submit = vi.fn();
const downloadSample = vi.fn();
const uploadData = vi.fn();

vi.mock('./campRequestFormApi.js', () => ({
  campRequestFormApi: {
    load: (...args) => load(...args),
    submit: (...args) => submit(...args),
    downloadSample: (...args) => downloadSample(...args),
    uploadData: (...args) => uploadData(...args),
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
          campDate: '2026-11-20',
          hq: 'Mumbai',
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
  downloadSample.mockReset();
  uploadData.mockReset();
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

  it('loads the program and shows a locked New Camp request form', async () => {
    renderPage();
    const form = await screen.findByTestId('request-form');
    expect(form.getAttribute('data-lock')).toBe('true');
    expect(form.getAttribute('data-request-only')).toBe('true');
    expect(form.getAttribute('data-has-lookup')).toBe('true');
    expect(screen.getByRole('heading', { name: 'New Camp Request' })).toBeTruthy();
    expect(screen.getByText(/Acme Health · Viva BMD · BMD/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /bulk upload/i })).toBeTruthy();
    expect(screen.getByAltText('TYLO')).toBeTruthy();
    await waitFor(() => expect(load).toHaveBeenCalledWith('token-1'));
  });

  it('opens bulk upload options for sample download and data upload', async () => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:sample';
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sample');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    downloadSample.mockResolvedValue(new Blob(['Doctor Name'], { type: 'text/csv' }));
    uploadData.mockResolvedValue({
      summary: { created: 2, skipped: 0, failed: 0 },
      created: [{ campId: 'C-1' }, { campId: 'C-2' }],
    });

    renderPage();
    await screen.findByTestId('request-form');

    fireEvent.click(screen.getByRole('button', { name: /bulk upload/i }));
    expect(screen.getByRole('menuitem', { name: /download sample template/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /upload data/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: /download sample template/i }));
    await waitFor(() => expect(downloadSample).toHaveBeenCalledWith('token-1'));

    fireEvent.click(screen.getByRole('button', { name: /bulk upload/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /upload data/i }));
    const fileInput = document.querySelector('.camp-program-request__file');
    expect(fileInput).toBeTruthy();
    const file = new File(['Doctor Name\nAnita Sharma'], 'camps.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(uploadData).toHaveBeenCalledWith('token-1', file));
    expect(await screen.findByText(/2 camp requests submitted for Camp One review/i)).toBeTruthy();
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
    expect(payload.source).toBe('program_form');
    expect(await screen.findByText(/Request submitted for Camp One review as C-100/i)).toBeTruthy();
  });
});
