import { useEffect, useState } from 'react';
import DateInput from '../../components/ui/DateInput.jsx';
import { downloadExcel } from '../../shared/api.js';
import { ACTION } from '../../shared/labels.js';
import {
  readStoredSavedDocumentFilters,
  savedDocumentsListQuery,
  subscribeSavedDocumentFilters,
  writeStoredSavedDocumentFilters,
} from './financeDocumentsFilterStorage.js';

export default function FinanceSavedDocumentsNavTools() {
  const [filters, setFilters] = useState(readStoredSavedDocumentFilters);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => subscribeSavedDocumentFilters(setFilters), []);

  function changeDate(field, value) {
    writeStoredSavedDocumentFilters({
      [field]: value,
      page: 1,
    });
  }

  function clearDates() {
    writeStoredSavedDocumentFilters({
      dateFrom: '',
      dateTo: '',
      page: 1,
    });
  }

  async function exportRows() {
    setExportBusy(true);
    setExportError('');
    try {
      const params = savedDocumentsListQuery(readStoredSavedDocumentFilters(), {
        includePaging: false,
      });
      const qs = params.toString();
      await downloadExcel(
        qs ? `/finance/commercial-documents/export?${qs}` : '/finance/commercial-documents/export',
        'Saved_Documents.xlsx',
      );
    } catch (err) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExportBusy(false);
    }
  }

  const hasDates = Boolean(filters.dateFrom || filters.dateTo);

  return (
    <div className="finance-sub-nav-tools">
      <div className="finance-sub-nav-dates" role="group" aria-label="Document date range">
        <DateInput
          hideLabel
          placeholder="From"
          aria-label="From date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(next) => changeDate('dateFrom', next)}
        />
        <span className="finance-sub-nav-dates-sep" aria-hidden="true">
          –
        </span>
        <DateInput
          hideLabel
          placeholder="To"
          aria-label="To date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(next) => changeDate('dateTo', next)}
        />
        {hasDates ? (
          <button
            type="button"
            className="finance-sub-nav-dates-clear"
            aria-label="Clear dates"
            onClick={clearDates}
          >
            ×
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="btn secondary btn-compact finance-sub-nav-export"
        disabled={exportBusy}
        title={exportError || 'Download Excel of the current list'}
        onClick={exportRows}
      >
        {exportBusy ? ACTION.EXPORTING : 'Export'}
      </button>
      {exportError ? (
        <span className="finance-sub-nav-export-status" role="status">
          {exportError}
        </span>
      ) : null}
    </div>
  );
}
