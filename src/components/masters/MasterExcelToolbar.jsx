import { useState } from 'react';
import { api, downloadExcel } from '../../shared/api.js';
import { ACTION } from '../../shared/labels.js';
import { IMPORT_ACCEPT_HINT } from '../../shared/importFilePolicy.js';
import {
  getErrorMessage,
  validateImportFileClient,
  formatRowImportError,
} from '../../shared/importErrors.js';
import {
  csvDelimiterLabel,
  isCsvFileName,
  parseCsvTable,
  readCsvFileText,
} from '../../shared/csvParse.js';
import ImportActionButton from '../ui/ImportActionButton.jsx';
import ModalShell from '../ui/ModalShell.jsx';
import Button from '../ui/Button.jsx';

const PREVIEW_ROW_LIMIT = 8;

/**
 * Standard master actions: Download and Import (sample lives inside Import).
 * Import accepts CSV (primary) or Excel; CSV preview shows detected delimiter
 * and column mapping before commit.
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
  secondary = false,
  downloadLabel = ACTION.DOWNLOAD,
  importHint = IMPORT_ACCEPT_HINT,
}) {
  const [exportBusy, setExportBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);

  const compactClass = compact ? ' btn-compact' : '';
  const secondaryClass = secondary || compact ? ' secondary' : '';
  const downloadBtnClass = `btn${secondaryClass}${compactClass}`;
  const acceptHint = importHint || IMPORT_ACCEPT_HINT;

  const reportError = (err) => {
    const message = getErrorMessage(err, acceptHint);
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

  const closePreview = () => {
    if (importBusy) return;
    setPreview(null);
  };

  const prepareImport = async (file) => {
    if (!importPath || !file) return;
    const pre = validateImportFileClient(file);
    if (pre) {
      reportError(pre);
      return;
    }
    setMsg('');

    if (isCsvFileName(file.name)) {
      try {
        const text = await readCsvFileText(file);
        const table = parseCsvTable(text);
        if (!table.headers.length) {
          reportError(new Error('CSV has no header row. Download the sample format and try again.'));
          return;
        }
        if (!table.rows.length) {
          reportError(new Error('CSV has no data rows. Add at least one row under the headers.'));
          return;
        }
        if (table.headers.length < 2) {
          reportError(
            new Error(
              'Could not split columns (entire row looks like one cell). Save as UTF-8 CSV with comma, semicolon, or tab separators.',
            ),
          );
          return;
        }
        setPreview({
          file,
          kind: 'csv',
          headers: table.headers,
          rows: table.rows.slice(0, PREVIEW_ROW_LIMIT),
          totalRows: table.rows.length,
          delimiter: table.delimiter,
          delimiterLabel: csvDelimiterLabel(table.delimiter),
        });
        return;
      } catch (err) {
        reportError(err);
        return;
      }
    }

    setPreview({
      file,
      kind: 'excel',
      headers: [],
      rows: [],
      totalRows: null,
      delimiter: null,
      delimiterLabel: null,
    });
  };

  const confirmImport = async () => {
    if (!importPath || !preview?.file) return;
    setImportBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', preview.file);
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
      setPreview(null);
    } catch (err) {
      reportError(err);
    } finally {
      setImportBusy(false);
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
      <ImportActionButton
        canImport={Boolean(canImport && importPath)}
        hasSample={Boolean(samplePath)}
        onImport={prepareImport}
        onSample={handleSample}
        importBusy={importBusy}
        sampleBusy={sampleBusy}
        compact={compact}
        title={acceptHint}
      />
      {msg && !onError ? <span className="muted mono-sm">{msg}</span> : null}

      {preview ? (
        <ModalShell
          open
          onClose={closePreview}
          title="Preview import"
          overlayClassName="modal-overlay"
          panelClassName="modal-card modal-card--lg import-preview-modal"
        >
          <div className="import-preview-body">
            <p className="modal-message import-preview-meta">
              <strong>{preview.file?.name || 'Selected file'}</strong>
              {preview.kind === 'csv' ? (
                <>
                  {' '}
                  · {preview.totalRows} data row{preview.totalRows === 1 ? '' : 's'}
                  {' '}
                  · delimiter: {preview.delimiterLabel}
                  {' '}
                  · {preview.headers.length} columns
                </>
              ) : (
                <> · Excel workbook — columns are mapped on the server using the sample headers.</>
              )}
            </p>

            {preview.kind === 'csv' ? (
              <div className="import-preview-table-wrap" role="region" aria-label="CSV data preview">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      {preview.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIdx) => (
                      <tr key={`preview-row-${rowIdx}`}>
                        {preview.headers.map((_, colIdx) => (
                          <td key={`preview-cell-${rowIdx}-${colIdx}`}>{row[colIdx] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.totalRows > PREVIEW_ROW_LIMIT ? (
                  <p className="muted import-preview-more">
                    Showing first {PREVIEW_ROW_LIMIT} of {preview.totalRows} rows.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="muted">
                Confirm to upload. Prefer UTF-8 CSV (comma, semicolon, or tab) when you need a cell-level preview.
              </p>
            )}
          </div>

          <div className="confirm-actions modal-actions">
            <Button variant="secondary" disabled={importBusy} onClick={closePreview}>
              Cancel
            </Button>
            <Button variant="primary" loading={importBusy} onClick={confirmImport}>
              {importBusy ? ACTION.IMPORTING : 'Confirm import'}
            </Button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
