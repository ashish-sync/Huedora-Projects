import { useEffect, useMemo, useState } from 'react';
import FeedbackBanner, { PageAlerts } from '../../components/ui/FeedbackBanner.jsx';
import ImportInProgressGuard from '../../components/ui/ImportInProgressGuard.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { ClientPaginatedTable } from './components/ClientPaginatedTable';
import { dashboardApi, importApi } from './campOpsApi.js';
import { DEFAULT_PAGE_SIZE } from './constants/pagination';
import { ACTION } from '../../shared/labels.js';
import { trimString } from './utils/trimInput';
import { formatDateDDMMYYYY } from './utils/dateFormat';
import { downloadCampSampleFile } from './utils/campSampleDownload.js';
import { getErrorMessage, validateImportFileClient } from '../../shared/importErrors.js';
import { IMPORT_ACCEPT_ATTR, IMPORT_ACCEPT_HINT } from '../../shared/importFilePolicy.js';
import { importInvalidRowView, importPreviewSummary } from './utils/campImportPreview.js';

const STEPS_ADMIN = ['Upload', 'Map Headers', 'Preview', 'Import'];
const STEPS_EMPLOYEE = ['Upload', 'Preview', 'Import'];

async function parseApiErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return getErrorMessage(json?.error?.message || json?.message, fallback);
    } catch {
      return fallback;
    }
  }
  return getErrorMessage(err, fallback);
}

export default function ImportPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  const canImport = hasPermission('import:create') || hasPermission('import:execute');
  const isAdminImport = isSuperAdmin();
  const steps = isAdminImport ? STEPS_ADMIN : STEPS_EMPLOYEE;

  const [step, setStep] = useState(0);
  const [fields, setFields] = useState([]);
  const [standardMapping, setStandardMapping] = useState({});
  const [templates, setTemplates] = useState([]);
  const [fileMeta, setFileMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [defaultClientName, setDefaultClientName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [preview, setPreview] = useState(null);
  const [invalidPage, setInvalidPage] = useState(1);
  const [validPage, setValidPage] = useState(1);
  const [invalidPageSize, setInvalidPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [validPageSize, setValidPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const requests = [importApi.fields(), dashboardApi.clients()];
    if (isAdminImport) {
      requests.splice(1, 0, importApi.templates());
    }

    Promise.all(requests)
      .then((responses) => {
        const fieldsRes = responses[0];
        const clientsRes = isAdminImport ? responses[2] : responses[1];
        setFields(fieldsRes.data?.fields || []);
        setStandardMapping(fieldsRes.data?.standardMapping || {});
        if (isAdminImport) {
          setTemplates(Array.isArray(responses[1].data?.data) ? responses[1].data.data : []);
        }
        const clients = Array.isArray(clientsRes.data?.data) ? clientsRes.data.data : [];
        if (clients[0]) {
          setDefaultClientName(clients[0].name);
        }
      })
      .catch((err) =>
        setError(
          getErrorMessage(err, 'Could not load import settings. Refresh the page and try again.')
        )
      );
  }, [isAdminImport]);

  const requiredMissing = useMemo(
    () => fields.filter((field) => field.required && !mapping[field.key]).map((field) => field.label),
    [fields, mapping]
  );

  const previewStep = isAdminImport ? 2 : 1;
  const resultStep = isAdminImport ? 3 : 2;

  const previewDisplay = useMemo(() => {
    if (!preview) return null;
    return {
      summary: importPreviewSummary(preview),
      invalidRows: Array.isArray(preview.invalidRows) ? preview.invalidRows : [],
      validRows: Array.isArray(preview.validRows) ? preview.validRows : [],
    };
  }, [preview]);

  async function runPreview(nextRows, nextMapping) {
    const clientName = trimString(defaultClientName);
    setDefaultClientName(clientName);
    const { data } = await importApi.preview({
      rows: nextRows,
      mapping: nextMapping,
      defaultClientName: clientName,
    });
    setPreview(data);
    setInvalidPage(1);
    setValidPage(1);
    setStep(previewStep);
  }

  async function handleUpload(file) {
    if (!file) return;
    const pre = validateImportFileClient(file);
    if (pre) {
      setError(pre);
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await importApi.parse(file);
      const nextMeta = {
        fileName: data.fileName,
        sheetName: data.sheetName,
        totalRows: data.totalRows,
        sampleRows: data.sampleRows,
      };
      const nextRows = data.rows;
      const nextHeaders = data.headers;

      setFileMeta(nextMeta);
      setHeaders(nextHeaders);
      setRows(nextRows);
      setPreview(null);

      if (isAdminImport) {
        setMapping(data.suggestions || {});
        setStep(1);
        return;
      }

      if (data.missingStandardHeaders?.length) {
        setError(
          `This file does not match the required format. Missing columns: ${data.missingStandardHeaders.join(', ')}. Download the sample CSV and use those exact column headers.`
        );
        return;
      }

      const nextMapping = data.standardMapping || standardMapping;
      setMapping(nextMapping);
      await runPreview(nextRows, nextMapping);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'The file could not be read. Use a .csv (preferred) or Excel workbook (.xlsx / .xls / .xlsb) matching the sample headers.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function applyTemplate(templateId) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) setMapping(template.mapping || {});
  }

  async function saveTemplateOnly() {
    const name = trimString(templateName);
    setTemplateName(name);
    if (!name) {
      setError('Enter a template name before saving');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await importApi.saveTemplate({ name, mapping });
      const { data } = await importApi.templates();
      setTemplates(Array.isArray(data?.data) ? data.data : []);
      setError('');
      alert('Template saved successfully');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the import template. Check the name and try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    if (requiredMissing.length) {
      setError(`Map required fields: ${requiredMissing.join(', ')}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await runPreview(rows, mapping);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Preview failed. Map every required column to a file header, then try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const clientName = trimString(defaultClientName);
    const name = isAdminImport ? trimString(templateName) : '';
    setDefaultClientName(clientName);
    if (isAdminImport) setTemplateName(name);
    setLoading(true);
    setError('');
    try {
      const { data } = await importApi.confirm({
        rows,
        mapping,
        defaultClientName: clientName,
        templateName: name,
      });
      setResult(data);
      setStep(resultStep);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Import could not be completed. Fix invalid rows in the preview, then try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadSample() {
    setError('');
    try {
      await downloadCampSampleFile();
    } catch (err) {
      setError(await parseApiErrorMessage(err, 'Could not download the sample CSV. Please try again.'));
    }
  }

  function resetImport() {
    setStep(0);
    setFileMeta(null);
    setRows([]);
    setPreview(null);
    setResult(null);
    setMapping({});
    setSelectedTemplateId('');
    setTemplateName('');
  }

  if (!canImport) {
    return (
      <div className="empty-state">
        <p>You do not have permission to import camps.</p>
        <Link to="/camp-one/manage" className="btn secondary">
          Back to camps
        </Link>
      </div>
    );
  }

  return (
    <>
      <ImportInProgressGuard active={loading} />

      <div className="import-steps" aria-disabled={loading}>
        {steps.map((label, index) => (
          <span key={label} className={`step-pill${step === index ? ' active' : ''}`}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {(error || result) && (
        <PageAlerts
          items={[
            error && { variant: 'error', message: error },
            result && {
              variant: 'success',
              message: `Import complete: ${result.summary.created} created, ${result.summary.skipped} skipped, ${result.summary.invalid} invalid.`,
            },
          ].filter(Boolean)}
        />
      )}

      {step === 0 && (
        <div className="import-card">
          <h3>Upload Excel / CSV</h3>
          {isAdminImport ? (
            <p className="import-intro">
              Upload camp data from CSV with automatic header suggestions, or download the sample file. Columns match the Create Camp form.
            </p>
          ) : (
            <p className="import-intro">
              Download the sample CSV file and fill in camp details using the same column headers as Create Camp.
            </p>
          )}

          <div className="sample-download-panel">
            <div>
              <strong>{isAdminImport ? 'Standard import format' : 'Step 1: Use the standard format'}</strong>
              <p>
                Download the sample file with Create Camp column headers and example rows.
                State, zone, district, and HQ are filled from PIN Code during import.
              </p>
            </div>
            <button type="button" className="btn secondary" onClick={handleDownloadSample} disabled={loading}>
              {ACTION.SAMPLE_FORMAT}
            </button>
          </div>

          <div className="upload-zone">
            <p><strong>{isAdminImport ? 'Upload your file' : 'Step 2: Upload your completed file'}</strong></p>
            <p className="import-muted">{IMPORT_ACCEPT_HINT}</p>
            <label className={`btn${loading ? ' is-disabled' : ''}`}>
              Choose file
              <input
                type="file"
                accept={IMPORT_ACCEPT_ATTR}
                disabled={loading}
                onChange={(e) => handleUpload(e.target.files?.[0])}
                title={IMPORT_ACCEPT_HINT}
              />
            </label>
          </div>
        </div>
      )}

      {isAdminImport && step >= 1 && fileMeta && (
        <div className="import-card">
          <h3>Header Mapping</h3>
          <FeedbackBanner variant="info">
            File: <strong>{fileMeta.fileName}</strong> | Sheet: <strong>{fileMeta.sheetName}</strong> | Rows: <strong>{fileMeta.totalRows}</strong>
          </FeedbackBanner>

          <div className="template-bar">
            <div className="field field-fixed">
              <label>Load saved template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                disabled={loading}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
            <div className="field field-fixed">
              <label>Default Client (fallback)</label>
              <input
                value={defaultClientName}
                onChange={(e) => setDefaultClientName(e.target.value)}
                onBlur={(e) => setDefaultClientName(trimString(e.target.value))}
                disabled={loading}
              />
            </div>
            <div className="field field-fixed">
              <label>Save as template</label>
              <input
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onBlur={(e) => setTemplateName(trimString(e.target.value))}
                disabled={loading}
              />
            </div>
            <button className="btn secondary" onClick={saveTemplateOnly} disabled={loading}>
              Save Template
            </button>
            <button className="btn" onClick={handlePreview} disabled={loading}>
              Preview Import
            </button>
          </div>

          <div className="mapping-grid">
            {fields.map((field) => (
              <div key={field.key} className={`mapping-row${field.required ? ' required' : ''}`}>
                <div>
                  <label>{field.label}</label>
                  <input value={field.key} disabled />
                </div>
                <div>
                  <label>Excel column</label>
                  <select
                    value={mapping[field.key] || ''}
                    disabled={loading}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {fileMeta.sampleRows?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3>Sample rows from file</h3>
              <div className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {headers.map((header) => <th key={header}>{header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {fileMeta.sampleRows.map((row, index) => (
                        <tr key={index}>
                          {headers.map((header) => <td key={header}>{String(row[header] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step >= previewStep && preview && previewDisplay && (
        <div className="import-card">
          <h3>Preview & Validation</h3>
          {!isAdminImport && fileMeta && (
            <FeedbackBanner variant="info">
              File: <strong>{fileMeta.fileName}</strong> | Sheet: <strong>{fileMeta.sheetName}</strong> | Rows: <strong>{fileMeta.totalRows}</strong>
            </FeedbackBanner>
          )}
          <div className="summary-grid">
            <div className="summary-card">
              <span>Total rows</span>
              <strong>{previewDisplay.summary.total}</strong>
            </div>
            <div className="summary-card">
              <span>Valid rows</span>
              <strong>{previewDisplay.summary.valid}</strong>
            </div>
            <div className="summary-card">
              <span>Invalid rows</span>
              <strong>{previewDisplay.summary.invalid}</strong>
            </div>
          </div>

          {previewDisplay.invalidRows.length > 0 && (
            <>
              <h3>Validation report</h3>
              <ClientPaginatedTable
                rows={previewDisplay.invalidRows}
                page={invalidPage}
                pageSize={invalidPageSize}
                onPageChange={setInvalidPage}
                onPageSizeChange={(size) => { setInvalidPageSize(size); setInvalidPage(1); }}
                itemLabel="invalid rows"
                renderTable={(pageRows) => (
                  <div className="table-card">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Client</th>
                            <th>Camp Date</th>
                            <th>Errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((row, index) => {
                            const view = importInvalidRowView(row, index);
                            return (
                              <tr key={view.rowNumber} className="validation-row-error">
                                <td>{view.rowNumber}</td>
                                <td>{view.clientName}</td>
                                <td>{view.campDate ? formatDateDDMMYYYY(view.campDate) : '-'}</td>
                                <td>{view.errors.join(', ') || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              />
            </>
          )}

          {previewDisplay.validRows.length > 0 && (
            <>
              <h3>Valid preview</h3>
              <ClientPaginatedTable
                rows={previewDisplay.validRows}
                page={validPage}
                pageSize={validPageSize}
                onPageChange={setValidPage}
                onPageSizeChange={(size) => { setValidPageSize(size); setValidPage(1); }}
                itemLabel="valid rows"
                renderTable={(pageRows) => (
                  <div className="table-card">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Client</th>
                            <th>Campaign</th>
                            <th>Doctor</th>
                            <th>City</th>
                            <th>Camp Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((row) => (
                            <tr key={row.rowNumber ?? `${row.clientName}-${row.campDate}`}>
                              <td>{row.clientName}</td>
                              <td>{row.campaignType}</td>
                              <td>{row.doctorName}</td>
                              <td>{row.city}</td>
                              <td>{row.campDate ? formatDateDDMMYYYY(row.campDate) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              />
            </>
          )}

          <div className="form-actions">
            <button className="btn" onClick={handleImport} disabled={loading || previewDisplay.summary.valid === 0}>
              {loading ? 'Importing...' : `Import ${previewDisplay.summary.valid} Camps`}
            </button>
            {isAdminImport ? (
              <button className="btn secondary" onClick={() => setStep(1)} disabled={loading}>
                Back to Mapping
              </button>
            ) : (
              <button className="btn secondary" onClick={resetImport} disabled={loading}>
                Upload Another File
              </button>
            )}
          </div>
        </div>
      )}

      {step === resultStep && result && (
        <div className="import-card">
          <h3>Import Result</h3>
          <div className="summary-grid">
            <div className="summary-card"><span>Created</span><strong>{result.summary.created}</strong></div>
            <div className="summary-card"><span>Skipped</span><strong>{result.summary.skipped}</strong></div>
            <div className="summary-card"><span>Invalid</span><strong>{result.summary.invalid}</strong></div>
          </div>
          {result.skipped?.length > 0 && (
            <FeedbackBanner variant="info">
              Some rows were skipped because the Client name did not match existing Clients.
            </FeedbackBanner>
          )}
          <div className="form-actions">
            <Link className="btn" to="/camp-one/manage">View Imported Camps</Link>
            <button className="btn secondary" onClick={resetImport}>
              Import Another File
            </button>
          </div>
        </div>
      )}
    </>
  );
}
