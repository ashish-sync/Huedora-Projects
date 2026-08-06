import { useRef, useState } from 'react';
import { api, downloadExcel } from '../../shared/api.js';
import { ACTION } from '../../shared/labels.js';
import { IMPORT_ACCEPT_ATTR, IMPORT_ACCEPT_HINT } from '../../shared/importFilePolicy.js';
import {
  getErrorMessage,
  validateImportFileClient,
  formatRowImportError,
} from '../../shared/importErrors.js';

/**
 * Standard master actions: Download, Sample format, Import.
 * Import accepts CSV (primary) or XLSB; samples are CSV.
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
  toolbarClassName = '',
  compact = false,
  downloadLabel = ACTION.DOWNLOAD,
}) {
  const fileRef = useRef(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const compactClass = compact ? ' btn-compact' : '';
  const downloadBtnClass = `btn${compactClass}`;
  const secondaryBtnClass = `btn secondary${compactClass}`;

  const reportError = (err) => {
    const message = getErrorMessage(err, IMPORT_ACCEPT_HINT);
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
      const name = sampleFilename
        ? String(sampleFilename).replace(/\.xlsx$/i, '.csv')
        : undefined;
      await downloadExcel(samplePath, name);
    } catch (err) {
      reportError(err);
    } finally {
      setSampleBusy(false);
    }
  };

  const runImport = async (file) => {
    if (!importPath || !file) return;
    const pre = validateImportFileClient(file);
    if (pre) {
      reportError(pre);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setImportBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api(importPath, { method: 'POST', body: fd });
      const errHint =
        data.errorRows > 0
          ? ` · ${data.errorRows} row${data.errorRows === 1 ? '' : 's'} failed`
          : '';
      const summary = `Imported ${data.created || 0} created · ${data.updated || 0} updated${errHint}`;
      setMsg(summary);
      if (data.errors?.length && onError) {
        onError(data.errors.slice(0, 3).map(formatRowImportError).join(' '));
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
      className={[
        'master-excel-toolbar',
        toolbarClassName,
        className,
      ].filter(Boolean).join(' ')}
    >
      {exportPath ? (
        <button
          className={downloadBtnClass}
          type="button"
          disabled={exportBusy}
          onClick={handleDownload}
        >
          {exportBusy ? ACTION.DOWNLOADING : downloadLabel}
        </button>
      ) : null}
      {samplePath ? (
        <button
          className={secondaryBtnClass}
          type="button"
          disabled={sampleBusy}
          onClick={handleSample}
        >
          {sampleBusy ? ACTION.DOWNLOADING : ACTION.SAMPLE_FORMAT}
        </button>
      ) : null}
      {canImport && importPath ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={IMPORT_ACCEPT_ATTR}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runImport(f);
            }}
          />
          <button
            className={secondaryBtnClass}
            type="button"
            disabled={importBusy}
            onClick={() => fileRef.current?.click()}
            title={IMPORT_ACCEPT_HINT}
          >
            {importBusy ? ACTION.IMPORTING : ACTION.IMPORT}
          </button>
        </>
      ) : null}
      {msg && !onError ? <span className="muted mono-sm">{msg}</span> : null}
    </div>
  );
}
