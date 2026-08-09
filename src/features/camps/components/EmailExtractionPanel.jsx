import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

const PASTE_MANDATORY_KEYS = new Set(['doctorName', 'pincode', 'campDate', 'startTime']);

const BODY_FIELDS = [
  { key: 'clientName', label: 'Client Name' },
  { key: 'campaignType', label: 'Division / Therapy' },
  { key: 'campaignName', label: 'Method' },
  { key: 'campDate', label: 'Camp Date', required: true },
  { key: 'startTime', label: 'Camp Start Time', required: true },
  { key: 'endTime', label: 'Camp End Time' },
  { key: 'doctorName', label: 'Doctor Name', required: true },
  { key: 'doctorCode', label: 'Doctor Code' },
  { key: 'campAddress', label: 'Camp / Clinic Address' },
  { key: 'state', label: 'State' },
  { key: 'zone', label: 'Zone' },
  { key: 'city', label: 'City' },
  { key: 'hq', label: 'HQ' },
  { key: 'pincode', label: 'PIN Code', required: true },
  { key: 'expectedPatients', label: 'Expected Patients' },
  { key: 'fieldPersonName', label: 'Contact Person Name' },
  { key: 'fieldPersonPhone', label: 'Contact Person Number' },
  { key: 'remarks', label: 'Remarks' },
];

const MANDATORY_FIELD_LABELS = {
  doctorName: 'Doctor Name',
  pincode: 'PIN Code',
  campDate: 'Camp Date',
  startTime: 'Camp Start Time',
};

function formatFieldValue(key, value, entry) {
  const display = entry?.pasteDisplay?.[key];
  if (display) return display;
  if (!value && value !== 0) return '—';
  if (key === 'campDate') return formatDateDDMMYYYY(value) || '—';
  return String(value);
}

function isMandatoryMissing(entry, key) {
  if (entry?.mandatoryMissing?.includes(key)) return true;
  if (!PASTE_MANDATORY_KEYS.has(key)) return false;
  if (entry?.valid || entry?.creationEligible) return false;
  const value = entry?.row?.[key];
  if (key === 'pincode') return !/^\d{6}$/.test(String(value || '').trim());
  return value == null || String(value).trim() === '';
}

function LinkedCampsBanner({ linkedCamps = [] }) {
  if (!linkedCamps.length) return null;

  return (
    <div className="email-linked-camps">
      <div className="email-linked-camps-header">
        <h4>Camps already created</h4>
        <span className="meta-text">{linkedCamps.length} linked camp(s)</span>
      </div>
      <div className="email-linked-camps-list">
        {linkedCamps.map((camp) => (
          <div key={camp.campId} className="email-linked-camp-item">
            <div className="email-linked-camp-copy">
              <strong>{camp.campId}</strong>
              <span>{camp.clientName || '—'} · {camp.campaignName || 'Camp'}</span>
              <span className="status-pill status-pill-muted">{camp.status?.replaceAll('_', ' ')}</span>
            </div>
            {camp.editable ? (
              <Link to={`/camp-one/manage/${camp.id}/edit`} className="btn secondary btn-compact">
                Edit camp
              </Link>
            ) : (
              <Link to={`/camp-one/manage/${camp.id}/edit`} className="btn secondary btn-compact">
                View camp
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExcelPreview({ excelPreview, mode, onChange }) {
  return excelPreview.map((file) => (
    <div key={file.fileName} className="email-preview-block">
      <div className="email-preview-block-header">
        <h4>Excel attachment</h4>
        <span className="meta-text">{file.fileName}</span>
      </div>
      <p className="meta-text">{file.validRows.length} valid row(s), {file.invalidRows.length} invalid row(s)</p>
      {file.validRows.length > 0 ? (
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Client</th>
                  <th>Division</th>
                  <th>Camp Date</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {file.validRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.clientName || '—'}</td>
                    <td>{row.campaignType || '—'}</td>
                    <td>{row.campDate ? formatDateDDMMYYYY(row.campDate) : '—'}</td>
                    <td>{row.city || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="email-detail-empty">No valid rows found in the Excel file.</div>
      )}
      {mode === 'edit' && (
        <p className="meta-text">Excel rows are imported as parsed. Re-extract if the attachment changes.</p>
      )}
    </div>
  ));
}

function getBodyRowStatus(entry) {
  if (entry.duplicateOf?.campId) {
    return {
      className: 'status-pill-warning',
      label: `Duplicate of ${entry.duplicateOf.campId}`,
    };
  }
  if (entry.valid) {
    return { className: 'status-pill-success', label: 'Ready' };
  }
  if (entry.partial || entry.creationEligible) {
    const pct = entry.completionPercent ? `${entry.completionPercent}%` : 'partial';
    return {
      className: 'status-pill-warning',
      label: `Creatable (${pct}) — complete before approval`,
    };
  }
  const missing = (entry.mandatoryMissing || [])
    .map((key) => MANDATORY_FIELD_LABELS[key] || key)
    .filter(Boolean);
  return {
    className: 'status-pill-muted',
    label: missing.length
      ? `Review required — missing ${missing.join(', ')}`
      : (entry.errors?.filter((err) => /doctor name|pin code|camp date|start time/i.test(err)).join('; ')
        || entry.errors?.[0]
        || 'Review required'),
  };
}

function BodyExtractionForm({
  rows,
  mode,
  activeField,
  onActiveFieldChange,
  onRowChange,
}) {
  if (!rows.length) {
    return <div className="email-detail-empty">No camp details could be extracted from this email.</div>;
  }

  if (mode === 'preview') {
    return (
      <div className="email-extraction-preview-list">
        {rows.map((entry) => {
          const rowStatus = getBodyRowStatus(entry);
          return (
          <article key={entry.rowNumber} className="email-extraction-card">
            <header className="email-extraction-card-header">
              <h4>Camp block {entry.rowNumber}</h4>
              <span className={`status-pill ${rowStatus.className}`}>
                {rowStatus.label}
              </span>
            </header>
            {(entry.mandatoryMissing || []).length > 0 || (!entry.valid && !entry.creationEligible && !entry.partial) ? (
              <p className="error email-extraction-mandatory-banner">
                Mandatory for creation: Doctor Name, PIN Code, Camp Date, Camp Start Time.
                {(entry.mandatoryMissing || []).length
                  ? ` Missing/invalid: ${(entry.mandatoryMissing || []).map((key) => MANDATORY_FIELD_LABELS[key] || key).join(', ')}.`
                  : ''}
              </p>
            ) : null}
            <dl className="email-extraction-dl">
              {BODY_FIELDS.map((field) => {
                const missing = isMandatoryMissing(entry, field.key);
                return (
                <div
                  key={field.key}
                  className={`email-extraction-dl-row${missing ? ' is-mandatory-missing' : ''}${field.required ? ' is-mandatory' : ''}`}
                >
                  <dt>{field.label}{field.required ? ' *' : ''}</dt>
                  <dd>{formatFieldValue(field.key, entry.row?.[field.key], entry)}</dd>
                </div>
                );
              })}
            </dl>
            {entry.extraction ? (
              <div className="email-extraction-meta">
                <p className="meta-text">
                  Extraction: {entry.extraction.method || entry.extraction.extractionMethod || 'deterministic'}
                  {entry.extraction.usedLlm ? ' (AI-assisted)' : ''}
                  {entry.extraction.confidence != null
                    ? ` · confidence ${Math.round(Number(entry.extraction.confidence) * 100)}%`
                    : ''}
                  {entry.extraction.status ? ` · ${entry.extraction.status}` : ''}
                </p>
                {Object.entries(entry.extraction.fieldProvenance || {})
                  .filter(([, provenance]) => provenance === 'inferred' || provenance === 'fuzzy_matched')
                  .slice(0, 6)
                  .map(([field, provenance]) => (
                    <p key={field} className="meta-text email-extraction-warning">
                      Low-confidence field: {field} ({provenance})
                    </p>
                  ))}
                {(entry.extraction.peopleMatches || [])
                  .filter((match) => match.status === 'AMBIGUOUS' || match.status === 'REVIEW')
                  .slice(0, 3)
                  .map((match) => (
                    <p key={`${match.name}-${match.status}`} className="meta-text email-extraction-warning">
                      Contact match needs review: {match.name || match.role || 'person'} ({match.status})
                    </p>
                  ))}
                {(entry.extraction.warnings || []).slice(0, 4).map((warning) => (
                  <p key={warning} className="meta-text email-extraction-warning">{warning}</p>
                ))}
                {(entry.extraction.conflicts || []).slice(0, 4).map((conflict) => (
                  <p key={conflict} className="error meta-text">{conflict}</p>
                ))}
              </div>
            ) : null}
            {entry.pasteDisplay?.locationSource === 'pin-master' ? (
              <p className="meta-text">City, state, and zone matched from PIN master.</p>
            ) : null}
            {entry.pasteFormatted ? (
              <details className="email-extraction-formatted">
                <summary>Formatted extraction output</summary>
                <pre>{entry.pasteFormatted}</pre>
              </details>
            ) : null}
          </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="email-extraction-edit-list">
      {rows.map((entry, rowIndex) => (
        <article key={entry.rowNumber} className="email-extraction-card">
          <header className="email-extraction-card-header">
            <h4>Camp block {entry.rowNumber}</h4>
            <span className="meta-text">Click ↖ on a field, select text, then Enter or → to insert</span>
          </header>
          <div className="email-extraction-form-grid">
            {BODY_FIELDS.map((field) => {
              const fieldActive = activeField?.rowIndex === rowIndex && activeField?.key === field.key;
              return (
                <label key={field.key} className={field.required ? 'required-field' : ''}>
                  <span className="email-extraction-field-label">
                    {field.label}
                    <button
                      type="button"
                      className={`email-pick-btn${fieldActive ? ' is-active' : ''}`}
                      title={`Pick from message for ${field.label}`}
                      onClick={() => onActiveFieldChange(
                        fieldActive
                          ? null
                          : { rowIndex, key: field.key, label: field.label },
                      )}
                    >
                      ↖
                    </button>
                  </span>
                  <input
                    value={entry.row?.[field.key] ?? ''}
                    onChange={(e) => onRowChange(rowIndex, field.key, e.target.value)}
                    placeholder={field.label}
                  />
                </label>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

export function EmailExtractionPanel({
  preview,
  linkedCamps = [],
  onPreviewChange,
  onActiveFieldChange,
  activeField,
  previewDirty = false,
  savingPreview = false,
  autoSavePreview = true,
  onToggleAutoSave,
  onSavePreview,
  onModeChange,
  emptyHint = 'Use “Extract & preview” once to parse camp details from this email.',
}) {
  const [mode, setMode] = useState('preview');

  function changeMode(nextMode) {
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  const bodyRows = useMemo(() => preview?.bodyPreview || [], [preview]);

  function getSaveStatusText() {
    if (savingPreview) return 'Saving…';
    if (previewDirty && autoSavePreview) return 'Saving…';
    if (previewDirty) return 'Unsaved edits';
    if (autoSavePreview) return 'Saved';
    return 'Review before import';
  }

  function updateBodyRow(rowIndex, key, value) {
    if (!preview?.bodyPreview) return;
    const nextRows = preview.bodyPreview.map((entry, index) => {
      if (index !== rowIndex) return entry;
      return {
        ...entry,
        row: {
          ...(entry.row || {}),
          [key]: value,
        },
      };
    });
    onPreviewChange({ ...preview, bodyPreview: nextRows });
  }

  if (!preview) {
    return (
      <div className="email-detail-empty">
        <p>No extraction preview yet.</p>
        <span className="meta-text">{emptyHint}</span>
      </div>
    );
  }

  return (
    <div className="email-extraction-panel">
      <LinkedCampsBanner linkedCamps={linkedCamps} />

      <div className="email-extraction-toolbar">
        <span className="meta-text email-extraction-save-status">{getSaveStatusText()}</span>
        <div className="email-extraction-toolbar-actions">
          {onToggleAutoSave && (
            <button
              type="button"
              className={`email-extraction-autosave-btn${autoSavePreview ? ' is-on' : ''}`}
              onClick={onToggleAutoSave}
              aria-pressed={autoSavePreview}
              title={autoSavePreview ? 'Autosave is on' : 'Autosave is off'}
            >
              {autoSavePreview ? 'Autosave on' : 'Autosave off'}
            </button>
          )}
          {previewDirty && !autoSavePreview && onSavePreview && (
            <button
              type="button"
              className="btn btn-compact email-extraction-save-btn"
              onClick={onSavePreview}
              disabled={savingPreview}
            >
              {savingPreview ? 'Saving…' : 'Save'}
            </button>
          )}
          <div className="email-extraction-mode-toggle" role="group" aria-label="Extraction view mode">
            <button
              type="button"
              className={`email-extraction-mode-btn${mode === 'preview' ? ' is-active' : ''}`}
              onClick={() => changeMode('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              className={`email-extraction-mode-btn${mode === 'edit' ? ' is-active' : ''}`}
              onClick={() => changeMode('edit')}
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {preview.excelPreview?.length ? (
        <ExcelPreview excelPreview={preview.excelPreview} mode={mode} />
      ) : (
        <BodyExtractionForm
          rows={bodyRows}
          mode={mode}
          activeField={activeField}
          onActiveFieldChange={onActiveFieldChange}
          onRowChange={updateBodyRow}
        />
      )}
    </div>
  );
}
