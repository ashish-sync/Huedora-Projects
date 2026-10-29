import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import FinanceSavedDocumentsNavTools from './FinanceSavedDocumentsNavTools.jsx';

vi.mock('../../shared/api.js', () => ({
  downloadExcel: vi.fn(async () => {}),
}));

describe('FinanceSavedDocumentsNavTools', () => {
  beforeEach(() => {
    sessionStorage.clear();
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
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
  });
});
