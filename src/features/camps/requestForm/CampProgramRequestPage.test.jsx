import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampProgramRequestPage from './CampProgramRequestPage.jsx';

const load = vi.fn();
const submit = vi.fn();

vi.mock('./campRequestFormApi.js', () => ({
  campRequestFormApi: {
    load: (...args) => load(...args),
    submit: (...args) => submit(...args),
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
    expect(screen.getByText(/Acme Health · Viva BMD · BMD/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeTruthy();
    await waitFor(() => expect(load).toHaveBeenCalledWith('token-1'));
  });
});
