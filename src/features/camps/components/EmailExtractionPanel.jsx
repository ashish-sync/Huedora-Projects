import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

const BODY_FIELDS = [
  { key: 'clientName', label: 'Client Name', required: true },
  { key: 'campaignType', label: 'Division / Therapy' },
  { key: 'campaignName', label: 'Camp Name' },
  { key: 'doctorName', label: 'Doctor Name' },
  { key: 'doctorCode', label: 'Doctor Code' },
  { key: 'campAddress', label: 'Camp Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'campDate', label: 'Camp Date' },
  { key: 'startTime', label: 'Start Time' },
  { key: 'endTime', label: 'End Time' },
  { key: 'expectedPatients', label: 'Expected Patients' },
  { key: 'fieldPersonName', label: 'Field Person Name' },
  { key: 'fieldPersonPhone', label: 'Field Person Contact' },
  { key: 'remarks', label: 'Remarks' },
];

function formatFieldValue(key, value) {
  if (!value && value !== 0) return '—';
  if (key === 'campDate') return formatDateDDMMYYYY(value) || '—';
  return String(value);
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
              <Link to={`/camps/manage/${camp.id}/edit`} className="btn btn-secondary btn-sm">
                Edit camp
              </Link>
            ) : (
              <Link to={`/camps/manage/${camp.id}/edit`} className="btn btn-secondary btn-sm">
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
  if (!entry.valid) {
    return {
      className: 'status-pill-muted',
      label: entry.errors?.join(', ') || 'Invalid',
    };
  }
  if (entry.partial) {
    return { className: 'status-pill-success', label: 'Needs review' };
  }
  return { className: 'status-pill-success', label: 'Ready' };
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
            <dl className="email-extraction-dl">
              {BODY_FIELDS.map((field) => (
                <div key={field.key} className="email-extraction-dl-row">
                  <dt>{field.label}</dt>
                  <dd>{formatFieldValue(field.key, entry.row?.[field.key])}</dd>
                </div>
              ))}
            </dl>
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
    if (savingPreview) return 'Saving changes...';
    if (previewDirty && autoSavePreview) return 'Unsaved changes — auto-saving shortly';
    if (previewDirty) return 'You have unsaved edits — save before creating camps';
    if (autoSavePreview) return 'All changes saved automatically';
    return 'Review parsed camp details before import';
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
        <span className="meta-text">{getSaveStatusText()}</span>
        <div className="email-extraction-toolbar-actions">
          {onToggleAutoSave && (
            <label className="email-extraction-autosave-toggle">
              <input
                type="checkbox"
                checked={autoSavePreview}
                onChange={onToggleAutoSave}
              />
              Auto-save
            </label>
          )}
          {previewDirty && !autoSavePreview && onSavePreview && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSavePreview}
              disabled={savingPreview}
            >
              {savingPreview ? 'Saving...' : 'Save changes'}
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
