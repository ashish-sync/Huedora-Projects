import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampExecutePage from './CampExecutePage.jsx';
import { campExecuteApi } from './campExecuteApi.js';
import { formatTime } from '../../../shared/dateFormat.js';

vi.mock('./campExecuteApi.js', () => ({
  campExecuteApi: {
    load: vi.fn(),
    saveDraft: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    submit: vi.fn(),
  },
}));

vi.mock('./GpsSelfieCapture.jsx', () => ({
  GpsSelfieCapture: ({ open, onCapture }) => (open ? (
    <button
      type="button"
      onClick={() => onCapture(new File(['x'], 'selfie.jpg', { type: 'image/jpeg' }))}
    >
      Capture now
    </button>
  ) : null),
}));

vi.mock('../utils/prepareGpsSelfieForUpload.js', () => ({
  prepareGpsSelfieForUpload: vi.fn(async (file) => file),
}));

function makeContext({ gpsUploaded = false, gpsOutUploaded = false, inTime = '', outTime = '', capturedAt } = {}) {
  return {
    invite: { locked: false },
    camp: {
      campId: '26-10-0019',
      campDateLabel: 'Wednesday, 28 Oct 2026',
      doctorName: 'Demo Doctor',
      clinicLabel: '12 MG Road, Pune',
    },
    form: {
      inTime,
      outTime,
      patientsScreened: '',
      productCount: '',
      consumablesUsed: [],
      executorGps: capturedAt ? { capturedAt, latitude: 19.15, longitude: 72.85 } : null,
      executorGpsOut: null,
    },
    documents: [
      ...(gpsUploaded ? [{
        docType: 'gps_selfie',
        fileName: 'selfie.webp',
        url: 'https://example.com/s.webp',
        fileId: 'f1',
      }] : []),
      ...(gpsOutUploaded ? [{
        docType: 'gps_selfie_out',
        fileName: 'selfie-out.webp',
        url: 'https://example.com/so.webp',
        fileId: 'f2',
      }] : []),
    ],
    documentStatus: {
      doctor_form: 'required',
      patient_form: 'required',
      gps_selfie: gpsUploaded ? 'uploaded' : 'required',
      gps_selfie_out: gpsOutUploaded ? 'uploaded' : 'required',
    },
    gps: { radiusMeters: 250 },
    consumableOptions: [],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/camp-execute/tok']}>
      <Routes>
        <Route path="/camp-execute/:token" element={<CampExecutePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampExecutePage activity form layout', () => {
  beforeEach(() => {
    campExecuteApi.load.mockReset();
    campExecuteApi.saveDraft.mockReset();
    campExecuteApi.uploadDocument.mockReset();
    campExecuteApi.saveDraft.mockImplementation(async (_token, body) => makeContext({
      gpsUploaded: true,
      inTime: body?.inTime || '',
      outTime: body?.outTime || '',
    }));
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success) {
          success({ coords: { latitude: 19.1558, longitude: 72.8509, accuracy: 12 } });
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows GPS selfie on page 1 and not execution information', async () => {
    campExecuteApi.load.mockResolvedValue(makeContext());
    renderPage();

    await screen.findByText('26-10-0019');
    expect(screen.getByRole('heading', { name: 'GPS Selfie' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capture GPS Selfie' })).toBeTruthy();
    expect(screen.getByText(/Capture a live check-in photo/)).toBeTruthy();
    expect(screen.queryByText('Required')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Execution Information' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Consumables Used' })).toBeNull();
    expect(screen.queryByText('Doctor Form (DF)')).toBeNull();
    expect(screen.queryByText('Patient Form (PF)')).toBeNull();
  });

  it('shows a photo preview on page 1 after GPS capture, without duplicate status copy', async () => {
    campExecuteApi.load.mockResolvedValue(makeContext({ gpsUploaded: true }));
    renderPage();

    await screen.findByText('26-10-0019');
    expect(screen.getByRole('img', { name: 'Check-in selfie' })).toBeTruthy();
    expect(screen.getByText('Captured')).toBeTruthy();
    expect(screen.queryByText(/GPS Selfie \(GS\) captured/)).toBeNull();
    expect(screen.queryByText(/Capture a live check-in photo/)).toBeNull();
    expect(screen.queryByText('selfie.webp')).toBeNull();
    expect(screen.queryByText(/Clinic GPS not set/)).toBeNull();
  });

  it('requires GPS selfie before leaving page 1', async () => {
    campExecuteApi.load.mockResolvedValue(makeContext());
    renderPage();

    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Capture the GPS Selfie before continuing')).toBeTruthy();
    expect(campExecuteApi.saveDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'GPS Selfie' })).toBeTruthy();
  });

  it('shows execution information and consumables on page 2, without paper docs', async () => {
    campExecuteApi.load.mockResolvedValue(makeContext({ gpsUploaded: true }));
    renderPage();

    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Execution Information' })).toBeTruthy();
    });
    expect(screen.queryByLabelText(/In Time/)).toBeNull();
    expect(screen.queryByLabelText(/Out Time/)).toBeNull();
    expect(screen.queryByText('Filled from GPS selfie')).toBeNull();
    expect(screen.getByLabelText(/Patients Screened/)).toBeTruthy();
    expect(screen.getByLabelText(/Product Count/)).toBeTruthy();
    expect(screen.queryByText('Doctor Form (DF)')).toBeNull();
    expect(screen.queryByText('Patient Form (PF)')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Upload Documents' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Consumables Used' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Consumables Used' }).checked).toBe(false);
    expect(screen.queryByText('Item name')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add another row' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'GPS Selfie' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Capture GPS Selfie' })).toBeNull();
  });

  it('opens consumable rows only after the Consumables Used checkbox is ticked', async () => {
    campExecuteApi.load.mockResolvedValue(makeContext({ gpsUploaded: true }));
    renderPage();

    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const toggle = await screen.findByRole('checkbox', { name: 'Consumables Used' });
    expect(screen.queryByText('Item name')).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByText('Item name')).toBeTruthy();
    expect(screen.getByText('Used')).toBeTruthy();
    expect(screen.getByText('Wastage')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Add another row' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '+ Add another row' }));
    expect(screen.getAllByText('Item name')).toHaveLength(2);
  });

  it('moves upload documents onto page 3', async () => {
    campExecuteApi.load.mockResolvedValue(makeContext({ gpsUploaded: true }));
    renderPage();

    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('checkbox', { name: 'Consumables Used' });

    fireEvent.change(screen.getByLabelText(/Patients Screened/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Product Count/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upload Documents' })).toBeTruthy();
    });
    expect(screen.getByText('Doctor Form (DF)')).toBeTruthy();
    expect(screen.getByText('Patient Form (PF)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload Doctor Form (DF)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload Patient Form (PF)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'GPS Selfie' })).toBeTruthy();
    expect(screen.getByText(/This sets Out Time/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capture GPS Selfie' })).toBeTruthy();
    expect(screen.queryByText('Required')).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Execution Information' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Consumables Used' })).toBeNull();
  });

  it('sets In Time from the GPS selfie capture clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const capturedAt = new Date('2026-10-28T09:02:00');
    vi.setSystemTime(capturedAt);
    const expected = formatTime(capturedAt);

    campExecuteApi.load.mockResolvedValue(makeContext());
    campExecuteApi.uploadDocument.mockImplementation(async (_token, payload) => makeContext({
      gpsUploaded: true,
      inTime: payload?.inTime || '',
    }));

    renderPage();
    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Capture GPS Selfie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Capture now' }));

    await waitFor(() => {
      expect(campExecuteApi.uploadDocument).toHaveBeenCalled();
    });
    expect(campExecuteApi.saveDraft.mock.calls[0][1].inTime).toBe(expected);
    expect(campExecuteApi.uploadDocument.mock.calls[0][1].docType).toBe('gps_selfie');
    expect(campExecuteApi.uploadDocument.mock.calls[0][1].inTime).toBe(expected);
    expect(campExecuteApi.uploadDocument.mock.calls[0][1].outTime).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Execution Information' })).toBeTruthy();
    });
    expect(screen.queryByLabelText(/In Time/)).toBeNull();
    expect(screen.queryByLabelText(/Out Time/)).toBeNull();
    expect(campExecuteApi.saveDraft.mock.calls.at(-1)[1].inTime).toBe(expected);
    expect(campExecuteApi.saveDraft.mock.calls.at(-1)[1].outTime).toBeUndefined();
  });

  it('saves In Time from an existing GPS selfie capture without showing the field', async () => {
    const capturedAt = '2026-10-28T09:02:00';
    campExecuteApi.load.mockResolvedValue(makeContext({
      gpsUploaded: true,
      capturedAt,
    }));

    renderPage();
    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Execution Information' })).toBeTruthy();
    });
    expect(screen.queryByLabelText(/In Time/)).toBeNull();
    expect(campExecuteApi.saveDraft.mock.calls.at(-1)[1].inTime).toBe(formatTime(capturedAt));
    expect(campExecuteApi.saveDraft.mock.calls.at(-1)[1].outTime).toBeUndefined();
  });

  it('sets Out Time from the page 3 GPS selfie capture clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const capturedAt = new Date('2026-10-28T11:05:00');
    vi.setSystemTime(capturedAt);
    const expected = formatTime(capturedAt);

    campExecuteApi.load.mockResolvedValue(makeContext({ gpsUploaded: true, inTime: '09:02' }));
    campExecuteApi.uploadDocument.mockImplementation(async (_token, payload) => makeContext({
      gpsUploaded: true,
      gpsOutUploaded: true,
      inTime: '09:02',
      outTime: payload?.outTime || '',
    }));

    renderPage();
    await screen.findByText('26-10-0019');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('checkbox', { name: 'Consumables Used' });
    fireEvent.change(screen.getByLabelText(/Patients Screened/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Product Count/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Upload Documents' });

    fireEvent.click(screen.getByRole('button', { name: 'Capture GPS Selfie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Capture now' }));

    await waitFor(() => {
      expect(campExecuteApi.uploadDocument).toHaveBeenCalled();
    });
    expect(campExecuteApi.uploadDocument.mock.calls[0][1].docType).toBe('gps_selfie_out');
    expect(campExecuteApi.uploadDocument.mock.calls[0][1].outTime).toBe(expected);
    expect(campExecuteApi.saveDraft.mock.calls.some((call) => call[1].outTime === expected)).toBe(true);
  });
});
