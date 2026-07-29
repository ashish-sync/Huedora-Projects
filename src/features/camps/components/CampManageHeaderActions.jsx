import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadExcel } from '../../../shared/api.js';
import { useCampOpsAuth } from '../useCampOpsAuth.js';
import { useCampWorkingStage } from '../CampWorkingStageContext.jsx';
import { downloadCampSampleFile } from '../utils/campSampleDownload.js';
import { DateInput } from './DateInput';

export function CampManageHeaderActions({
  exportAllStages = false,
  showDateFilter = false,
  hideNewCamp = false,
}) {
  const { hasPermission } = useCampOpsAuth();
  const { workingStage } = useCampWorkingStage();
  const [searchParams] = useSearchParams();
  const [exportBusy, setExportBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canCreateCamp = hasPermission('camps:create') || hasPermission('camps:update');
  const canImport = hasPermission('import:create');
  const canDownload = hasPermission('camps:read');

  async function handleDownloadCamps() {
    if (showDateFilter && !dateFrom && !dateTo) {
      window.alert('Select a date range before downloading camps.');
      return;
    }
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      if (exportAllStages) {
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
      } else {
        searchParams.forEach((value, key) => {
          params.set(key, value);
        });
        if (workingStage) params.set('lifecycleStage', workingStage);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
      }
      const qs = params.toString();
      const path = qs ? `/camp-ops/camps/export?${qs}` : '/camp-ops/camps/export';
      await downloadExcel(path, 'Camps_Export.xlsx');
    } catch (err) {
      window.alert(err?.message || 'Failed to download camps');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDownloadSample() {
    setSampleBusy(true);
    try {
      await downloadCampSampleFile();
    } catch (err) {
      window.alert(err?.message || 'Failed to download sample format');
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <div className="inv-header-actions camp-header-toolbar">
      {showDateFilter && canDownload && (
        <div className="camp-export-date-range" role="group" aria-label="Export date range">
          <label className="camp-export-date-label">
            <span className="camp-export-date-label-text">From</span>
            <DateInput hideLabel value={dateFrom} onChange={setDateFrom} aria-label="Export from date" />
          </label>
          <label className="camp-export-date-label">
            <span className="camp-export-date-label-text">To</span>
            <DateInput hideLabel value={dateTo} onChange={setDateTo} aria-label="Export to date" />
          </label>
        </div>
      )}
      <div className="camp-export-actions">
        {canDownload && (
          <button
            className="btn secondary btn-compact"
            type="button"
            disabled={exportBusy}
            onClick={handleDownloadCamps}
          >
            {exportBusy ? 'Downloading…' : exportAllStages ? 'Download All Camps' : 'Download Camps'}
          </button>
        )}
        {canDownload && (
          <button
            className="btn secondary btn-compact"
            type="button"
            disabled={sampleBusy}
            onClick={handleDownloadSample}
          >
            {sampleBusy ? 'Downloading…' : 'Sample Format'}
          </button>
        )}
        {canImport && (
          <Link className="btn secondary btn-compact" to="/camps/import">
            Excel Import
          </Link>
        )}
        {canCreateCamp && !hideNewCamp && (
          <Link className="btn btn-compact" to="/camps/manage/new">
            + New Camp
          </Link>
        )}
      </div>
    </div>
  );
}
