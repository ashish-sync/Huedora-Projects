import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { CampNameSelect } from './components/CampNameSelect';
import { ClientNameSearchInput } from './components/ClientNameSearchInput';
import { SearchableOptionsInput } from './components/SearchableOptionsInput';
import { clientMasterApi } from './campOpsApi.js';
import { clientMasterListPath } from './clientMasterPaths.js';
import { trimFormStrings } from './utils/trimInput';
import {
  getProgramDocumentMeta,
  openProgramDocument,
  validateProgramPdfFile,
} from './utils/programDocument';
import {
  hasValidationErrors,
  recordToForm,
  validateClientMasterForm,
} from './utils/clientMasterValidation';

const SERVICE_MODEL_OPTIONS = ['HCW + Device', 'Device Only', 'HCW Only', 'Rented'];
const HEALTHCARE_WORKER_OPTIONS = ['Technician', 'Phlebotomist', 'Dietician'];

const formStringFields = [
  'clientName',
  'clientCode',
  'programName',
  'campName',
  'campType',
  'coordinatorName',
  'healthcareWorker',
  'campDuration',
  'spocName',
  'spocNumber',
  'requestTimeline',
];

const formNumberFields = [
  'poAmount',
  'executedCampUnit',
  'cancelledCampUnit',
  'otUnit',
  'minimumPatientCovered',
  'minimumKmsCovered',
  'extPatientUnit',
  'kmsUnit',
];

const emptyForm = {
  clientId: '',
  clientName: '',
  clientCode: '',
  programName: '',
  campName: 'BMD',
  campType: '',
  coordinatorName: '',
  healthcareWorker: '',
  poAmount: '',
  campDuration: '4:00',
  spocName: '',
  spocNumber: '',
  requestTimeline: '',
  executedCampUnit: '',
  cancelledCampUnit: '',
  otUnit: '',
  minimumPatientCovered: '',
  minimumKmsCovered: '',
  extPatientUnit: '',
  kmsUnit: '',
  isActive: true,
};

function FieldError({ message }) {
  if (!message) return null;
  return <small className="field-error">{message}</small>;
}

function numberInputProps(field, form, updateField, fieldErrors) {
  return {
    type: 'text',
    inputMode: 'numeric',
    value: form[field],
    onChange: (e) => updateField(field, e.target.value.replace(/[^\d]/g, '')),
    className: fieldErrors[field] ? 'input-invalid' : '',
  };
}

export default function ClientMasterFormPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const canCreateCompany = hasPermission('clients:create');
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [documentMeta, setDocumentMeta] = useState(null);
  const [pendingPdfFile, setPendingPdfFile] = useState(null);
  const [documentError, setDocumentError] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return undefined;

    setFetching(true);
    clientMasterApi.get(id)
      .then(({ data }) => {
        setForm(recordToForm(data.data));
        setDocumentMeta(getProgramDocumentMeta(data.data));
        setPendingPdfFile(null);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load client master record');
      })
      .finally(() => setFetching(false));

    return undefined;
  }, [id, isEdit]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function applySuggestion(record) {
    const nextForm = recordToForm(record);
    if (record.clientId) {
      nextForm.clientId = String(record.clientId);
    }
    setForm(nextForm);
    setFieldErrors({});
    setError('');
  }

  function updateClientName(value) {
    setForm((prev) => ({
      ...prev,
      clientName: value,
      ...(canCreateCompany ? {} : { clientId: '' }),
    }));
    setFieldErrors((prev) => {
      if (!prev.clientName) return prev;
      const next = { ...prev };
      delete next.clientName;
      return next;
    });
  }

  function validateForm() {
    const errors = validateClientMasterForm(form);
    setFieldErrors(errors);
    return !hasValidationErrors(errors);
  }

  async function handlePdfSelect(file) {
    if (!file) {
      setPendingPdfFile(null);
      setDocumentError('');
      return;
    }

    const validationMessage = validateProgramPdfFile(file);
    if (validationMessage) {
      setPendingPdfFile(null);
      setDocumentError(validationMessage);
      return;
    }

    if (isEdit) {
      setDocumentLoading(true);
      setDocumentError('');
      try {
        const { data } = await clientMasterApi.uploadDocument(id, file);
        setDocumentMeta(getProgramDocumentMeta(data.data));
        setPendingPdfFile(null);
      } catch (err) {
        setDocumentError(err?.message || 'Failed to upload program document');
      } finally {
        setDocumentLoading(false);
      }
      return;
    }

    setPendingPdfFile(file);
    setDocumentError('');
  }

  async function handleDeleteDocument() {
    if (!isEdit || !documentMeta) return;
    if (!window.confirm('Delete this program PDF?')) return;

    setDocumentLoading(true);
    setDocumentError('');
    try {
      const { data } = await clientMasterApi.deleteDocument(id);
      setDocumentMeta(getProgramDocumentMeta(data.data));
      setPendingPdfFile(null);
    } catch (err) {
      setDocumentError(err?.message || 'Failed to delete program document');
    } finally {
      setDocumentLoading(false);
    }
  }

  async function handlePreviewDocument() {
    if (!isEdit || !documentMeta) return;
    setDocumentError('');
    try {
      await openProgramDocument(id);
    } catch (err) {
      setDocumentError(err.message || 'Failed to open program document');
      if (err.documentCleared) {
        setDocumentMeta(null);
        setPendingPdfFile(null);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
      setError('Please fix the highlighted fields');
      return;
    }

    if (!canCreateCompany && !form.clientId) {
      setError('Select an existing company from the search list. New companies can only be created by an administrator.');
      return;
    }

    const trimmed = trimFormStrings(form, formStringFields);
    const payload = {
      ...trimmed,
      clientId: form.clientId || undefined,
      isActive: form.isActive,
    };
    formNumberFields.forEach((field) => {
      payload[field] = trimmed[field] === '' ? 0 : Number(form[field]) || 0;
    });

    setLoading(true);
    setError('');
    setDocumentError('');
    try {
      let savedId = id;
      if (isEdit) {
        await clientMasterApi.update(id, payload);
      } else {
        const { data } = await clientMasterApi.create(payload);
        savedId = data.data._id;
      }

      if (pendingPdfFile) {
        const { data } = await clientMasterApi.uploadDocument(savedId, pendingPdfFile);
        setDocumentMeta(getProgramDocumentMeta(data.data));
      }

      navigate(clientMasterListPath());
    } catch (err) {
      const message = err?.message || 'Failed to save client master record';
      if (pendingPdfFile && !isEdit && err.response?.status !== 400) {
        setError(`${message}. Program was created but PDF upload may have failed — edit the program to upload again.`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="empty-state">Loading client master record...</div>;
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="page-alerts">
          <div className="error-banner">{error}</div>
        </div>
      )}

      <div className="form-grid">
        <label>
          Client Name
          <ClientNameSearchInput
            value={form.clientName}
            error={fieldErrors.clientName}
            onChange={updateClientName}
            onSelectRecord={applySuggestion}
            requireExistingClient={!canCreateCompany}
          />
          {!canCreateCompany && (
            <small className="meta-text">Select an existing company. You cannot create new companies.</small>
          )}
        </label>
        <label>
          Client Code
          <input
            value={form.clientCode}
            onChange={(e) => updateField('clientCode', e.target.value.toUpperCase())}
            placeholder={canCreateCompany ? 'Optional — auto-generated if new client' : 'Filled when you select a company'}
            readOnly={!canCreateCompany}
            className={fieldErrors.clientCode ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.clientCode} />
        </label>
        <label>
          Status
          <select value={form.isActive ? 'active' : 'inactive'} onChange={(e) => updateField('isActive', e.target.value === 'active')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label>
          Division / Therapy
          <input
            value={form.programName}
            onChange={(e) => updateField('programName', e.target.value)}
            placeholder="e.g. Viva BMD Camps, Ortreso"
            className={fieldErrors.programName ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.programName} />
        </label>
        <label>
          Camp Name
          <CampNameSelect
            value={form.campName}
            onChange={(value) => updateField('campName', value)}
            error={fieldErrors.campName}
          />
        </label>
        <label>
          Service Model
          <SearchableOptionsInput
            value={form.campType}
            onChange={(value) => updateField('campType', value)}
            options={SERVICE_MODEL_OPTIONS}
            placeholder="e.g. HCW + Device"
            groupLabel="Service models"
            error={fieldErrors.campType}
          />
        </label>
        <label>
          Coordinator Name
          <input
            value={form.coordinatorName}
            onChange={(e) => updateField('coordinatorName', e.target.value)}
            className={fieldErrors.coordinatorName ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.coordinatorName} />
        </label>
        <label>
          Healthcare Worker
          <SearchableOptionsInput
            value={form.healthcareWorker}
            onChange={(value) => updateField('healthcareWorker', value)}
            options={HEALTHCARE_WORKER_OPTIONS}
            placeholder="e.g. Technician"
            groupLabel="Healthcare workers"
            error={fieldErrors.healthcareWorker}
          />
        </label>
        <label>
          PO Amount
          <input {...numberInputProps('poAmount', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.poAmount} />
        </label>
        <label>
          Camp Duration
          <input
            value={form.campDuration}
            onChange={(e) => updateField('campDuration', e.target.value)}
            placeholder="4:00"
            className={fieldErrors.campDuration ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.campDuration} />
        </label>
        <label>
          SPOC Name
          <input
            value={form.spocName}
            onChange={(e) => updateField('spocName', e.target.value)}
            className={fieldErrors.spocName ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.spocName} />
        </label>
        <label>
          SPOC Number
          <input
            type="text"
            inputMode="numeric"
            value={form.spocNumber}
            onChange={(e) => updateField('spocNumber', e.target.value.replace(/[^\d]/g, ''))}
            className={fieldErrors.spocNumber ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.spocNumber} />
        </label>
        <label>
          Request Timeline
          <input
            value={form.requestTimeline}
            onChange={(e) => updateField('requestTimeline', e.target.value)}
            placeholder="5 Days Before"
            className={fieldErrors.requestTimeline ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.requestTimeline} />
        </label>
        <label>
          Executed Camp Unit
          <input {...numberInputProps('executedCampUnit', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.executedCampUnit} />
        </label>
        <label>
          Cancelled Camp Unit
          <input {...numberInputProps('cancelledCampUnit', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.cancelledCampUnit} />
        </label>
        <label>
          OT Unit
          <input {...numberInputProps('otUnit', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.otUnit} />
        </label>
        <label>
          Minimum Patient Covered
          <input {...numberInputProps('minimumPatientCovered', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.minimumPatientCovered} />
        </label>
        <label>
          Minimum Kms Covered
          <input {...numberInputProps('minimumKmsCovered', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.minimumKmsCovered} />
        </label>
        <label>
          Ext. Patient Unit
          <input {...numberInputProps('extPatientUnit', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.extPatientUnit} />
        </label>
        <label>
          Kms Unit
          <input {...numberInputProps('kmsUnit', form, updateField, fieldErrors)} />
          <FieldError message={fieldErrors.kmsUnit} />
        </label>
      </div>

      <div className="form-card program-document-section">
        <h3>Program Document (PDF)</h3>
        <p className="meta-text">One PDF per program configuration. Max 5 MB. Uploading a new file replaces the previous document.</p>
        {documentError && <div className="error-banner">{documentError}</div>}

        {documentMeta && (
          <div className="program-document-current">
            <div>
              <strong>{documentMeta.fileName}</strong>
              {documentMeta.fileSize > 0 && (
                <small className="meta-text"> ({Math.round(documentMeta.fileSize / 1024)} KB)</small>
              )}
            </div>
            <div className="actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handlePreviewDocument}>
                Preview PDF
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteDocument}
                disabled={documentLoading}
              >
                {documentLoading ? 'Deleting...' : 'Delete PDF'}
              </button>
            </div>
          </div>
        )}

        <div className="upload-zone" style={{ marginTop: '0.75rem' }}>
          <label htmlFor="program-pdf-upload">
            {documentLoading ? 'Uploading...' : documentMeta || pendingPdfFile ? 'Replace PDF' : 'Upload PDF'}
            <input
              id="program-pdf-upload"
              type="file"
              accept="application/pdf,.pdf"
              disabled={documentLoading}
              onChange={(e) => handlePdfSelect(e.target.files?.[0] || null)}
            />
          </label>
          {pendingPdfFile && (
            <small className="meta-text">Selected: {pendingPdfFile.name} ({Math.round(pendingPdfFile.size / 1024)} KB)</small>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn secondary" onClick={() => navigate(clientMasterListPath())}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update Configuration' : 'Create Configuration'}
        </button>
      </div>
    </form>
  );
}
