import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FinanceDocumentsList from './FinanceDocumentsList.jsx';
import {
  SAVED_DOCUMENTS_FILTER_STORAGE_KEY,
  readStoredSavedDocumentFilters,
} from './financeDocumentsFilterStorage.js';

vi.mock('../../shared/auth.jsx', () => ({
  useAuth: () => ({
    user: { role: 'admin' },
    can: () => true,
    isAdmin: () => true,
  }),
}));

vi.mock('../../shared/api.js', () => ({
  api: vi.fn(async () => ({ data: [], meta: { page: 1, limit: 25, total: 0, pages: 0 } })),
}));

vi.mock('./commercialOrgMaster.js', () => ({
  loadOrgListCache: () => [{ _id: 'org123abc', name: 'Rapid Diagno' }],
  fetchCommercialOrgList: async () => [{ _id: 'org123abc', name: 'Rapid Diagno' }],
}));

function renderList() {
  return render(
    <MemoryRouter>
      <FinanceDocumentsList embedded showCreateLink={false} />
    </MemoryRouter>,
  );
}

describe('FinanceDocumentsList filter persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('restores saved dropdowns after remount (open document and return)', async () => {
    sessionStorage.setItem(
      SAVED_DOCUMENTS_FILTER_STORAGE_KEY,
      JSON.stringify({
        q: '',
        orgProfileId: 'org123abc',
        documentType: 'bill_of_supply',
        status: 'Issued',
        paymentStatus: '',
        page: 1,
        limit: 25,
      }),
    );

    renderList();

    expect(screen.getByLabelText('Filter by organisation').value).toBe('org123abc');
    expect(screen.getByLabelText('Filter by type').value).toBe('bill_of_supply');
    expect(screen.getByLabelText('Filter by stage').value).toBe('Issued');
  });

  it('writes filters to sessionStorage when the user changes a dropdown', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByLabelText('Filter by type'), 'bill_of_supply');
    await user.selectOptions(screen.getByLabelText('Filter by stage'), 'Issued');

    expect(readStoredSavedDocumentFilters()).toMatchObject({
      documentType: 'bill_of_supply',
      status: 'Issued',
    });
  });
});
