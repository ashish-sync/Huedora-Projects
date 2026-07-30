import { useState } from 'react';
import { downloadExcel } from '../../shared/api.js';
import { useCampOpsAuth } from './useCampOpsAuth.js';
import { downloadCampExportSampleFile } from './utils/campExportSampleDownload.js';
import { DateInput } from './components/DateInput';
import { CampAdvancedExport } from './components/CampAdvancedExport.jsx';

export default function CampDownloadPage() {
  const { hasPermission } = useCampOpsAuth();
  const canDownload = hasPermission('camps:read');
  const [exportBusy, setExportBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState('xlsx');
  const [mode, setMode] = useState('quick');

  const hasDateRange = Boolean(dateFrom || dateTo);

  async function handleDownloadCamps() {
    if (!hasDateRange) return;
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (format === 'csv') params.set('format', 'csv');
      const qs = params.toString();
      const path = qs ? `/camp-ops/camps/export?${qs}` : '/camp-ops/camps/export';
      const filename = format === 'csv' ? 'Camps_Export.csv' : 'Camps_Export.xlsx';
      await downloadExcel(path, filename);
    } catch (err) {
      window.alert(err?.message || 'Failed to download camps');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDownloadSample() {
    setSampleBusy(true);
    try {
      await downloadCampExportSampleFile();
    } catch (err) {
      window.alert(err?.message || 'Failed to download sample format');
    } finally {
      setSampleBusy(false);
    }
  }

  if (!canDownload) {
    return (
      <div className="import-card">
        <p>You do not have permission to download camps.</p>
      </div>
    );
  }

  return (
    <div className="import-card camp-download-page">
      <div className="camp-download-mode-tabs" role="tablist" aria-label="Export mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'quick'}
          className={`camp-download-mode-tab${mode === 'quick' ? ' is-active' : ''}`}
          onClick={() => setMode('quick')}
        >
          Quick export
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'advanced'}
          className={`camp-download-mode-tab${mode === 'advanced' ? ' is-active' : ''}`}
          onClick={() => setMode('advanced')}
        >
          Advanced export
        </button>
      </div>

      <div className="camp-download-toolbar" role="group" aria-label="Export date range">
        <div className="camp-export-date-range camp-download-date-range">
          <label className="camp-export-date-inline">
            <span className="camp-export-date-inline-label">From</span>
            <DateInput
              hideLabel
              className="camp-export-date-field"
              value={dateFrom}
              onChange={setDateFrom}
              aria-label="Export from date"
            />
          </label>
          <span className="camp-export-date-sep">to</span>
          <label className="camp-export-date-inline">
            <span className="camp-export-date-inline-label">To</span>
            <DateInput
              hideLabel
              className="camp-export-date-field"
              value={dateTo}
              onChange={setDateTo}
              aria-label="Export to date"
            />
          </label>
          <label className="camp-export-date-inline camp-export-format-inline">
            <span className="camp-export-date-inline-label">Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Export file format">
              <option value="xlsx">Excel</option>
              <option value="csv">CSV</option>
            </select>
          </label>
        </div>

        {mode === 'quick' && (
          <div className="camp-export-actions camp-download-actions">
            <button
              className="btn btn-compact"
              type="button"
              disabled={exportBusy || !hasDateRange}
              onClick={handleDownloadCamps}
            >
              {exportBusy ? 'Downloading…' : 'Download all camps'}
            </button>
            <button
              className="btn secondary btn-compact"
              type="button"
              disabled={sampleBusy}
              onClick={handleDownloadSample}
            >
              {sampleBusy ? 'Downloading…' : 'Sample format'}
            </button>
          </div>
        )}
      </div>

      {mode === 'advanced' && (
        <CampAdvancedExport dateFrom={dateFrom} dateTo={dateTo} format={format} />
      )}
    </div>
  );
}
