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
  },
}));

vi.mock('../components/CampLifecycleForm.jsx', () => ({
  CampLifecycleForm: ({ lockProgramFields, requestOnly }) => (
    <div
      data-testid="request-form"
      data-lock={String(lockProgramFields)}
      data-request-only={String(requestOnly)}
    />
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
});
