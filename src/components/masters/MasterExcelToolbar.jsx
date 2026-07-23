import { useRef, useState } from 'react';
import { api, downloadExcel } from '../../shared/api.js';

/**
 * Standard master actions: Download, Sample Format, Excel Import.
 */
export default function MasterExcelToolbar({
  exportPath,
  samplePath,
  importPath,
  downloadFilename,
  sampleFilename,
  canImport = false,
  onImportComplete,
  onError,
  className = '',
  compact = false,
}) {
  const fileRef = useRef(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const reportError = (err) => {
    const message = err?.message || 'Request failed';
    if (onError) onError(message);
    else setMsg('');
    return message;
  };

  const handleDownload = async () => {
    if (!exportPath) return;
    setExportBusy(true);
    setMsg('');
    try {
      await downloadExcel(exportPath, downloadFilename);
    } catch (err) {
      reportError(err);
    } finally {
      setExportBusy(false);
    }
  };

  const handleSample = async () => {
    if (!samplePath) return;
    setSampleBusy(true);
    setMsg('');
    try {
      await downloadExcel(samplePath, sampleFilename);
    } catch (err) {
      reportError(err);
    } finally {
      setSampleBusy(false);
    }
  };

  const runImport = async (file) => {
    if (!importPath || !file) return;
    setImportBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api(importPath, { method: 'POST', body: fd });
      const errHint =
        data.errorRows > 0 ? ` · ${data.errorRows} row${data.errorRows === 1 ? '' : 's'} failed` : '';
      const summary = `Imported ${data.created || 0} created · ${data.updated || 0} updated${errHint}`;
      setMsg(summary);
      if (data.errors?.length && onError) {
        onError(data.errors.map((e) => `Row ${e.row}: ${e.message}`).slice(0, 3).join(' · '));
      }
      onImportComplete?.(data);
    } catch (err) {
      reportError(err);
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!exportPath && !samplePath && !importPath) return null;

  return (
    <div
      className={`master-excel-toolbar row${className ? ` ${className}` : ''}`}
      style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
    >
      {exportPath ? (
        <button
          className={`btn secondary${compact ? ' btn-compact' : ''}`}
          type="button"
          disabled={exportBusy}
          onClick={handleDownload}
        >
          {exportBusy ? 'Downloading…' : 'Download'}
        </button>
      ) : null}
      {samplePath ? (
        <button
          className={`btn secondary${compact ? ' btn-compact' : ''}`}
          type="button"
          disabled={sampleBusy}
          onClick={handleSample}
        >
          {sampleBusy ? 'Downloading…' : 'Sample Format'}
        </button>
      ) : null}
      {canImport && importPath ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runImport(f);
            }}
          />
          <button
            className={`btn secondary${compact ? ' btn-compact' : ''}`}
            type="button"
            disabled={importBusy}
            onClick={() => fileRef.current?.click()}
          >
            {importBusy ? 'Importing…' : 'Excel Import'}
          </button>
        </>
      ) : null}
      {msg && !onError ? <span className="muted mono-sm">{msg}</span> : null}
    </div>
  );
}
