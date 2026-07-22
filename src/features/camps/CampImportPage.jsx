import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { ClientPaginatedTable } from './components/ClientPaginatedTable';
import { dashboardApi, importApi } from './campOpsApi.js';
import { DEFAULT_PAGE_SIZE } from './constants/pagination';
import { trimString } from './utils/trimInput';
import { formatDateDDMMYYYY } from './utils/dateFormat';

const STEPS_ADMIN = ['Upload', 'Map Headers', 'Preview', 'Import'];
const STEPS_EMPLOYEE = ['Upload', 'Preview', 'Import'];

async function parseApiErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return json.message || fallback;
    } catch {
      return fallback;
    }
  }
  return err?.message || err.message || fallback;
}

import { downloadCampSampleFile } from './utils/campSampleDownload.js';

export default function ImportPage() {
  const { isSuperAdmin } = useAuth();
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
      .catch((err) => setError(err?.message || 'Failed to load import settings'));
  }, [isAdminImport]);

  const requiredMissing = useMemo(
    () => fields.filter((field) => field.required && !mapping[field.key]).map((field) => field.label),
    [fields, mapping]
  );

  const previewStep = isAdminImport ? 2 : 1;
  const resultStep = isAdminImport ? 3 : 2;

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
          `This file does not match the required format. Missing columns: ${data.missingStandardHeaders.join(', ')}. Download the sample Excel and use those exact column headers.`
        );
        return;
      }

      const nextMapping = data.standardMapping || standardMapping;
      setMapping(nextMapping);
      await runPreview(nextRows, nextMapping);
    } catch (err) {
      setError(err?.message || 'Failed to parse Excel file');
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
      setError(err?.message || 'Failed to save template');
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
      setError(err?.message || 'Preview failed');
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
      setError(err?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadSample() {
    setError('');
    try {
      await downloadCampSampleFile();
    } catch (err) {
      setError(await parseApiErrorMessage(err, 'Failed to download sample file'));
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

  return (
    <>
      <div className="import-steps">
        {steps.map((label, index) => (
          <span key={label} className={`step-pill${step === index ? ' active' : ''}`}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {(error || result) && (
        <div className="page-alerts">
          {error && <div className="error-banner">{error}</div>}
          {result && (
            <div className="success-banner">
              Import complete: {result.summary.created} created, {result.summary.skipped} skipped, {result.summary.invalid} invalid.
            </div>
          )}
        </div>
      )}

      {step === 0 && (
        <div className="import-card">
          <h3>Upload Excel / CSV</h3>
          {isAdminImport ? (
            <p className="import-intro">
              Upload camp data from Excel with automatic header suggestions, or download the sample file. Columns match Client Master (client + division + camp name) and the Create Camp form.
            </p>
          ) : (
            <p className="import-intro">
              Download the sample Excel file and fill in camp details using the same column headers as the website (client, program, and camp scheduling fields).
            </p>
          )}

          <div className="sample-download-panel">
            <div>
              <strong>{isAdminImport ? 'Standard import format' : 'Step 1: Use the standard format'}</strong>
              <p>Download the sample file with the correct column headers and 15 example rows. Only fields shown on Client Master and Create Camp are included.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleDownloadSample}>
              Download Sample Excel
            </button>
          </div>

          <div className="upload-zone">
            <p><strong>{isAdminImport ? 'Upload your file' : 'Step 2: Upload your completed file'}</strong></p>
            <p className="import-muted">Supported: .xlsx, .xls, .csv</p>
            <label className="btn btn-primary">
              Choose File
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
            </label>
          </div>
          {loading && <div className="empty-state">Parsing file...</div>}
        </div>
      )}

      {isAdminImport && step >= 1 && fileMeta && (
        <div className="import-card">
          <h3>Header Mapping</h3>
          <div className="info-banner">
            File: <strong>{fileMeta.fileName}</strong> | Sheet: <strong>{fileMeta.sheetName}</strong> | Rows: <strong>{fileMeta.totalRows}</strong>
          </div>

          <div className="template-bar">
            <div className="field field-fixed">
              <label>Load saved template</label>
              <select value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
            <div className="field field-fixed">
              <label>Default client (fallback)</label>
              <input
                value={defaultClientName}
                onChange={(e) => setDefaultClientName(e.target.value)}
                onBlur={(e) => setDefaultClientName(trimString(e.target.value))}
              />
            </div>
            <div className="field field-fixed">
              <label>Save as template</label>
              <input
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onBlur={(e) => setTemplateName(trimString(e.target.value))}
              />
            </div>
            <button className="btn btn-secondary" onClick={saveTemplateOnly} disabled={loading}>
              Save Template
            </button>
            <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
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

      {step >= previewStep && preview && (
        <div className="import-card">
          <h3>Preview & Validation</h3>
          {!isAdminImport && fileMeta && (
            <div className="info-banner">
              File: <strong>{fileMeta.fileName}</strong> | Sheet: <strong>{fileMeta.sheetName}</strong> | Rows: <strong>{fileMeta.totalRows}</strong>
            </div>
          )}
          <div className="summary-grid">
            <div className="summary-card">
              <span>Total rows</span>
              <strong>{preview.summary.total}</strong>
            </div>
            <div className="summary-card">
              <span>Valid rows</span>
              <strong>{preview.summary.valid}</strong>
            </div>
            <div className="summary-card">
              <span>Invalid rows</span>
              <strong>{preview.summary.invalid}</strong>
            </div>
          </div>

          {preview.invalidRows.length > 0 && (
            <>
              <h3>Validation report</h3>
              <ClientPaginatedTable
                rows={preview.invalidRows}
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
                          {pageRows.map((row) => (
                            <tr key={row.rowNumber} className="validation-row-error">
                              <td>{row.rowNumber}</td>
                              <td>{row.data.clientName || '-'}</td>
                              <td>{row.data.campDate ? formatDateDDMMYYYY(row.data.campDate) : '-'}</td>
                              <td>{row.errors.join(', ')}</td>
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

          {preview.validRows.length > 0 && (
            <>
              <h3>Valid preview</h3>
              <ClientPaginatedTable
                rows={preview.validRows}
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
                            <tr key={row.rowNumber}>
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
            <button className="btn btn-primary" onClick={handleImport} disabled={loading || preview.summary.valid === 0}>
              {loading ? 'Importing...' : `Import ${preview.summary.valid} Camps`}
            </button>
            {isAdminImport ? (
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Back to Mapping
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={resetImport}>
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
            <div className="info-banner">
              Some rows were skipped because the client name did not match existing clients.
            </div>
          )}
          <div className="form-actions">
            <Link className="btn btn-primary" to="/camps/manage">View Imported Camps</Link>
            <button className="btn btn-secondary" onClick={resetImport}>
              Import Another File
            </button>
          </div>
        </div>
      )}
    </>
  );
}
