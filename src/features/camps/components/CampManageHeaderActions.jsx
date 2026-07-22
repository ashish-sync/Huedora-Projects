import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadExcel } from '../../../shared/api.js';
import { useCampOpsAuth } from '../useCampOpsAuth.js';
import { downloadCampSampleFile } from '../utils/campSampleDownload.js';

export function CampManageHeaderActions() {
  const { hasPermission } = useCampOpsAuth();
  const [searchParams] = useSearchParams();
  const [exportBusy, setExportBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);

  const canCreateCamp = hasPermission('camps:create') || hasPermission('camps:update');
  const canImport = hasPermission('import:create');
  const canDownload = hasPermission('camps:read');

  async function handleDownloadCamps() {
    setExportBusy(true);
    try {
      const qs = searchParams.toString();
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
    <div className="inv-header-actions">
      {canDownload && (
        <button
          className="btn secondary btn-compact"
          type="button"
          disabled={exportBusy}
          onClick={handleDownloadCamps}
        >
          {exportBusy ? 'Downloading…' : 'Download Camps'}
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
      {canCreateCamp && (
        <Link className="btn btn-compact" to="/camps/manage/new">
          + New Camp
        </Link>
      )}
    </div>
  );
}
