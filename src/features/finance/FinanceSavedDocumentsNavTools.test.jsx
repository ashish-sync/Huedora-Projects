import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { downloadExcel } from '../../shared/api.js';
import FinanceSavedDocumentsNavTools from './FinanceSavedDocumentsNavTools.jsx';

vi.mock('../../shared/api.js', () => ({
  downloadExcel: vi.fn(async () => {}),
}));

describe('FinanceSavedDocumentsNavTools', () => {
  beforeEach(() => {
    sessionStorage.clear();
    downloadExcel.mockClear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('renders from/to date filters and an export button on the nav row', () => {
    render(<FinanceSavedDocumentsNavTools />);
    expect(screen.getByLabelText('Document date range')).toBeTruthy();
    expect(screen.getByLabelText('From date')).toBeTruthy();
    expect(screen.getByLabelText('To date')).toBeTruthy();
    expect(screen.getByPlaceholderText('From')).toBeTruthy();
    expect(screen.getByPlaceholderText('To')).toBeTruthy();
    const exportBtn = screen.getByRole('button', { name: 'Export' });
    expect(exportBtn).toBeTruthy();
    expect(exportBtn.getAttribute('title')).toBe('Download Excel of the current list');
  });

  it('downloads Excel when Export is clicked', async () => {
    render(<FinanceSavedDocumentsNavTools />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => {
      expect(downloadExcel).toHaveBeenCalledWith(
        '/finance/commercial-documents/export',
        'Saved_Documents.xlsx',
      );
    });
  });
});
