import { useEffect, useRef, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import FieldError from '../../components/ui/FieldError.jsx';
import { PhoneField } from '../../components/ui/PhoneField.jsx';
import { useSuppressBrowserAutofill, AutofillDecoyFields } from '../../shared/suppressBrowserAutofill.js';
import { parseEmailList } from '../../shared/validation.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { CampNameSelect } from './components/CampNameSelect';
import { ClientNameSearchInput } from './components/ClientNameSearchInput';
import { SearchableOptionsInput } from './components/SearchableOptionsInput';
import { ClientMasterConsumablesField } from './components/ClientMasterConsumablesField.jsx';
import { ClientMasterCampTermsBox } from './components/ClientMasterCampTermsBox.jsx';
import { clientMasterApi } from './campOpsApi.js';
import { clientMasterListPath } from './clientMasterPaths.js';
import { trimFormStrings } from './utils/trimInput';
import { normalizeHealthcareWorkers } from './utils/healthcareWorkers.js';
import {
  buildCampTermsPayload,
  CAMP_TERMS,
  campTermsFilesFromRecord,
  combinePurchaseOrders,
  computePoTaxFields,
  createEmptyPurchaseOrder,
  emptyCampTermsFormFields,
  normalizeCampTerms,
  poAmountInputValue,
  purchaseOrdersFromRecord,
  validateCampTermsFile,
} from './utils/clientMasterPo.js';
import {
  hasValidationErrors,
  recordToForm,
  validateClientMasterForm,
} from './utils/clientMasterValidation';

const SERVICE_MODEL_OPTIONS = [
  'HCW Only',
  'Rented',
  'HCW + Device (Light Device)',
  'HCW + Device (Heavy Device)',
];
const HEALTHCARE_WORKER_OPTIONS = ['Technician', 'Phlebotomist', 'Dietician'];

const formStringFields = [
  'clientName',
  'clientCode',
  'billingAddress',
  'billingGstin',
  'billingPan',
  'billingStateName',
  'billingStateCode',
  'programName',
  'campName',
  'campType',
  'campDuration',
  'spocName',
  'spocNumber',
  'spocEmail',
  'requestTimeline',
  'assignedUserEmails',
  'poNumber',
  'poIssueDate',
  'poExpiryDate',
  'agreementStartDate',
  'agreementEffectiveDate',
  'agreementEndDate',
];

const formNumberFields = [
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
  billingAddress: '',
  billingGstin: '',
  billingPan: '',
  billingStateName: '',
  billingStateCode: '',
  programName: '',
  campName: 'BMD',
  campType: '',
  healthcareWorker: [],
  campDuration: '4:00',
  spocName: '',
  spocNumber: '',
  spocEmail: '',
  requestTimeline: '',
  assignedUserEmails: '',
  ...emptyCampTermsFormFields(),
  executedCampUnit: '',
  cancelledCampUnit: '',
  otUnit: '',
  minimumPatientCovered: '',
  minimumKmsCovered: '',
  extPatientUnit: '',
  kmsUnit: '',
  mappedConsumables: [],
  isActive: true,
  updatedAt: '',
};

function numberInputProps(field, form, updateField, fieldErrors) {
  return {
    type: 'text',
    inputMode: 'numeric',
    value: form[field],
    onChange: (e) => updateField(field, e.target.value.replace(/[^\d]/g, '')),
    className: fieldErrors[field] ? 'input-invalid' : '',
  };
}

function healthcareRoleSelected(selected, role) {
  const want = String(role || '').trim().toLowerCase();
  return normalizeHealthcareWorkers(selected).some((item) => {
    const have = String(item || '').trim().toLowerCase();
    if (have === want) return true;
    return (
      (want === 'dietician' || want === 'dietitian') &&
      (have === 'dietician' || have === 'dietitian')
    );
  });
}

function toggleHealthcareRole(selected, role) {
  const current = normalizeHealthcareWorkers(selected);
  if (healthcareRoleSelected(current, role)) {
    return current.filter((item) => !healthcareRoleSelected([item], role));
  }
  return [...current, role];
}

export default function ClientMasterFormPage() {
  const { id } = useParams();
  const { hasPermission, isSuperAdmin } = useAuth();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const canCreateCompany = hasPermission('clients:create');
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [pendingCampTermsFiles, setPendingCampTermsFiles] = useState([]);
  const [pendingPoFiles, setPendingPoFiles] = useState({});
  const [campTermsFileBusy, setCampTermsFileBusy] = useState(false);
  const formRef = useRef(null);
  useSuppressBrowserAutofill(formRef);

  useEffect(() => {
    if (!isEdit) return undefined;

    setFetching(true);
    clientMasterApi.get(id)
      .then(({ data }) => {
        setForm(recordToForm(data.data));
        setPendingCampTermsFiles([]);
        setPendingPoFiles({});
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load Client Master record');
      })
      .finally(() => setFetching(false));

    return undefined;
  }, [id, isEdit]);

  function updateField(field, value) {
    setForm((prev) => {
      if (field !== 'campTerms') {
        return { ...prev, [field]: value };
      }
      const nextTerms = normalizeCampTerms(value);
      const next = { ...prev, campTerms: nextTerms };
      if (nextTerms === CAMP_TERMS.PO_BASED) {
        const orders = Array.isArray(prev.purchaseOrders) ? prev.purchaseOrders : [];
        next.purchaseOrders = orders.length ? orders : [createEmptyPurchaseOrder()];
        next.campTermsFiles = [];
      } else {
        next.purchaseOrders = [];
        if (nextTerms === CAMP_TERMS.NONE) {
          next.campTermsFiles = [];
        }
      }
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[field] && field !== 'campTerms') return prev;
      const next = { ...prev };
      delete next[field];
      delete next.purchaseOrders;
      return next;
    });
  }

  function addPurchaseOrder(row = createEmptyPurchaseOrder()) {
    setForm((prev) => {
      const orders = Array.isArray(prev.purchaseOrders) ? prev.purchaseOrders : [];
      return { ...prev, purchaseOrders: [...orders, row] };
    });
    setFieldErrors((prev) => {
      if (!prev.purchaseOrders) return prev;
      const next = { ...prev };
      delete next.purchaseOrders;
      return next;
    });
  }

  function removePurchaseOrder(poId) {
    setForm((prev) => {
      const orders = (Array.isArray(prev.purchaseOrders) ? prev.purchaseOrders : []).filter(
        (row) => row.id !== poId
      );
      return {
        ...prev,
        purchaseOrders: orders.length ? orders : [createEmptyPurchaseOrder()],
      };
    });
    setPendingPoFiles((prev) => {
      if (!prev[poId]) return prev;
      const next = { ...prev };
      delete next[poId];
      return next;
    });
  }

  function updatePurchaseOrder(poId, field, value) {
    setForm((prev) => {
      const orders = (Array.isArray(prev.purchaseOrders) ? prev.purchaseOrders : []).map((row) => {
        if (row.id !== poId) return row;
        const next = { ...row, [field]: value };
        if (field === 'poNetValue' || field === 'poAmount' || field === 'poApplyGst18') {
          const applyNext = field === 'poApplyGst18' ? value : row.poApplyGst18 !== false;
          const entered =
            field === 'poApplyGst18'
              ? poAmountInputValue(row)
              : value;
          if (entered === '' || entered == null) {
            Object.assign(next, {
              poApplyGst18: applyNext,
              poNetValue: '',
              poGstAmount: 0,
              poGrossValue: '',
            });
          } else {
            Object.assign(next, computePoTaxFields(entered, applyNext));
          }
        }
        return next;
      });
      return { ...prev, purchaseOrders: orders, ...combinePurchaseOrders(orders) };
    });
    setFieldErrors((prev) => {
      const keys = Object.keys(prev).filter((key) => key.includes(poId) || key.startsWith('purchaseOrders.'));
      if (!keys.length) return prev;
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
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

  async function handleCampTermsFilesSelect(fileList) {
    const files = Array.isArray(fileList) ? fileList : [];
    if (!files.length) return;

    for (const file of files) {
      const message = validateCampTermsFile(file);
      if (message) {
        setFieldErrors((prev) => ({ ...prev, campTermsFiles: message }));
        return;
      }
    }
    setFieldErrors((prev) => {
      if (!prev.campTermsFiles) return prev;
      const next = { ...prev };
      delete next.campTermsFiles;
      return next;
    });

    if (isEdit) {
      setCampTermsFileBusy(true);
      try {
        const { data } = await clientMasterApi.uploadCampTermsFiles(id, files);
        setForm((prev) => ({
          ...prev,
          campTermsFiles: campTermsFilesFromRecord(data.data),
        }));
        setPendingCampTermsFiles([]);
      } catch (err) {
        setFieldErrors((prev) => ({
          ...prev,
          campTermsFiles: err?.message || 'Failed to upload files',
        }));
      } finally {
        setCampTermsFileBusy(false);
      }
      return;
    }

    setPendingCampTermsFiles((prev) => [...prev, ...files]);
  }

  async function handleCampTermsFilePreview(file) {
    if (!isEdit || (!file?.id && !file?.storedName)) return;
    try {
      const fileId = file.id || file.storedName;
      const { data: blob } = await clientMasterApi.downloadCampTermsFile(id, fileId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err?.message || 'Failed to open file');
    }
  }

  async function handleCampTermsFileDelete(file) {
    if (!isSuperAdmin() || !isEdit || !file) return;
    if (!window.confirm(`Remove “${file.fileName || 'file'}”?`)) return;
    setCampTermsFileBusy(true);
    try {
      const fileId = file.id || file.storedName;
      const { data } = await clientMasterApi.deleteCampTermsFile(id, fileId);
      setForm((prev) => ({
        ...prev,
        campTermsFiles: campTermsFilesFromRecord(data.data),
      }));
    } catch (err) {
      setError(err?.message || 'Failed to remove file');
    } finally {
      setCampTermsFileBusy(false);
    }
  }

  async function handlePoFilesSelect(poId, fileList) {
    const files = Array.isArray(fileList) ? fileList : [];
    if (!poId || !files.length) return;

    for (const file of files) {
      const message = validateCampTermsFile(file);
      if (message) {
        setFieldErrors((prev) => ({ ...prev, [`purchaseOrders.${poId}.files`]: message }));
        return;
      }
    }

    if (isEdit) {
      setCampTermsFileBusy(true);
      try {
        const { data } = await clientMasterApi.uploadPoFiles(id, files, poId);
        setForm((prev) => {
          const nextForm = recordToForm(data.data);
          return {
            ...prev,
            ...combinePurchaseOrders(nextForm.purchaseOrders),
            purchaseOrders: nextForm.purchaseOrders,
            campTerms: CAMP_TERMS.PO_BASED,
          };
        });
        setPendingPoFiles((prev) => {
          if (!prev[poId]) return prev;
          const next = { ...prev };
          delete next[poId];
          return next;
        });
      } catch (err) {
        setError(err?.message || 'Failed to upload PO files');
      } finally {
        setCampTermsFileBusy(false);
      }
      return;
    }

    setPendingPoFiles((prev) => ({
      ...prev,
      [poId]: [...(prev[poId] || []), ...files],
    }));
  }

  async function handlePoFilePreview(poId, file) {
    if (!isEdit || !poId) return;
    try {
      const fileId = file?.id || file?.storedName;
      if (fileId) {
        const { data: blob } = await clientMasterApi.downloadPoFileById(id, poId, fileId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      const { data: blob } = await clientMasterApi.downloadPoFile(id, poId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err?.message || 'Failed to open PO file');
    }
  }

  async function handlePoFileDelete(poId, file) {
    if (!isSuperAdmin() || !isEdit || !poId || !file) return;
    if (!window.confirm(`Remove “${file.fileName || 'file'}”?`)) return;
    setCampTermsFileBusy(true);
    try {
      const fileId = file.id || file.storedName;
      const { data } = await clientMasterApi.deletePoFileById(id, poId, fileId);
      setForm((prev) => {
        const nextForm = recordToForm(data.data);
        return {
          ...prev,
          ...combinePurchaseOrders(nextForm.purchaseOrders),
          purchaseOrders: nextForm.purchaseOrders.length
            ? nextForm.purchaseOrders
            : [createEmptyPurchaseOrder()],
          campTerms: CAMP_TERMS.PO_BASED,
        };
      });
    } catch (err) {
      setError(err?.message || 'Failed to remove PO file');
    } finally {
      setCampTermsFileBusy(false);
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
    const spocEmails = parseEmailList(form.spocEmail);
    const campTermsPayload = buildCampTermsPayload({
      ...form,
      ...trimmed,
      purchaseOrders: form.purchaseOrders,
      campTermsFiles: form.campTermsFiles,
    });
    const payload = {
      ...trimmed,
      healthcareWorker: normalizeHealthcareWorkers(form.healthcareWorker),
      clientId: form.clientId || undefined,
      isActive: form.isActive,
      coordinatorName: '',
      spocEmail: spocEmails.join(', '),
      ...campTermsPayload,
      billing: {
        address: trimmed.billingAddress || '',
        gstin: trimmed.billingGstin || '',
        pan: trimmed.billingPan || '',
        stateName: trimmed.billingStateName || '',
        stateCode: trimmed.billingStateCode || '',
        contactPerson: trimmed.spocName || '',
        email: spocEmails[0] || '',
        phone: trimmed.spocNumber || '',
      },
      assignedUserEmails: parseEmailList(form.assignedUserEmails),
      ...(Array.isArray(form.mappedConsumables) && form.mappedConsumables.length
        ? { mappedConsumables: form.mappedConsumables }
        : {}),
      expectedUpdatedAt: form.updatedAt || undefined,
    };
    formNumberFields.forEach((field) => {
      payload[field] = trimmed[field] === '' ? 0 : Number(form[field]) || 0;
    });

    setLoading(true);
    setError('');
    try {
      let savedId = id;
      if (isEdit) {
        await clientMasterApi.update(id, payload);
      } else {
        const { data } = await clientMasterApi.create(payload);
        savedId = data.data._id;
      }

      if (pendingCampTermsFiles.length && savedId) {
        await clientMasterApi.uploadCampTermsFiles(savedId, pendingCampTermsFiles);
        setPendingCampTermsFiles([]);
      }

      const pendingEntries = Object.entries(pendingPoFiles).filter(([, files]) => files?.length);
      if (pendingEntries.length && savedId) {
        // Re-fetch so PO ids from server match pending keys when possible; otherwise map by order.
        let orders = Array.isArray(payload.purchaseOrders) ? payload.purchaseOrders : [];
        try {
          const { data } = await clientMasterApi.get(savedId);
          orders = purchaseOrdersFromRecord(data.data);
        } catch {
          /* use payload orders */
        }
        for (const [poId, files] of pendingEntries) {
          const target =
            orders.find((row) => row.id === poId)
            || orders.find((row) => String(row.poNumber || '') === String(
              (form.purchaseOrders || []).find((p) => p.id === poId)?.poNumber || ''
            ));
          if (!target?.id) continue;
          await clientMasterApi.uploadPoFiles(savedId, files, target.id);
        }
        setPendingPoFiles({});
      }

      navigate(clientMasterListPath());
    } catch (err) {
      setError(err?.message || 'Failed to save Client Master record');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="empty-state">Loading Client Master record...</div>;
  }

  return (
    <form ref={formRef} className="form-card" onSubmit={handleSubmit} noValidate autoComplete="off" data-form-type="other">
      <AutofillDecoyFields />
      {error && <FeedbackBanner variant="error">{error}</FeedbackBanner>}

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
            placeholder={canCreateCompany ? 'Optional — auto-generated if new Client' : 'Filled when you select a company'}
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
          Billing Address
          <textarea
            rows={2}
            value={form.billingAddress}
            onChange={(e) => updateField('billingAddress', e.target.value)}
            placeholder="Registered / billing address for GST invoices"
          />
        </label>
      </div>

      <h3 className="client-master-section-title">Billing details (Invoice recipient)</h3>
      <div className="form-grid">
        <label>
          State
          <input
            value={form.billingStateName}
            onChange={(e) => updateField('billingStateName', e.target.value)}
            placeholder="Maharashtra"
          />
        </label>
        <label>
          State Code
          <input
            value={form.billingStateCode}
            onChange={(e) => updateField('billingStateCode', e.target.value)}
            placeholder="27"
            maxLength={2}
          />
        </label>
        <label>
          GSTIN
          <input
            value={form.billingGstin}
            onChange={(e) => updateField('billingGstin', e.target.value.toUpperCase())}
            placeholder="15-character GSTIN"
            maxLength={15}
          />
        </label>
        <label>
          PAN
          <input
            value={form.billingPan}
            onChange={(e) => updateField('billingPan', e.target.value.toUpperCase())}
            placeholder="AAAAA0000A"
            maxLength={10}
          />
        </label>
      </div>

      <h3 className="client-master-section-title">Program</h3>
      <div className="form-grid">
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
          Method
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
            placeholder="e.g. HCW + Device (Light Device)"
            groupLabel="Service models"
            error={fieldErrors.campType}
          />
        </label>
        <div className={`client-master-hcw-field${fieldErrors.healthcareWorker ? ' is-invalid' : ''}`}>
          <span className="client-master-field-label" id="client-master-hcw-label">
            Healthcare Worker
          </span>
          <div
            className="client-master-hcw-roles"
            role="group"
            aria-labelledby="client-master-hcw-label"
          >
            {HEALTHCARE_WORKER_OPTIONS.map((option) => {
              const checked = healthcareRoleSelected(form.healthcareWorker, option);
              return (
                <label
                  key={option}
                  className={`client-master-hcw-role${checked ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={loading}
                    onChange={() =>
                      updateField(
                        'healthcareWorker',
                        toggleHealthcareRole(form.healthcareWorker, option)
                      )
                    }
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          <FieldError message={fieldErrors.healthcareWorker} />
        </div>
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
        <PhoneField
          label="SPOC Number"
          value={form.spocNumber}
          onChange={(value) => updateField('spocNumber', value)}
          error={fieldErrors.spocNumber}
        />
        <label>
          SPOC Email Address
          <input
            value={form.spocEmail}
            onChange={(e) => updateField('spocEmail', e.target.value)}
            placeholder="spoc@client.com, ops@client.com"
            title="Comma-separated SPOC email addresses"
            className={fieldErrors.spocEmail ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.spocEmail} />
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
          Assigned User Login Emails
          <input
            value={form.assignedUserEmails}
            onChange={(e) => updateField('assignedUserEmails', e.target.value)}
            placeholder="user@client.com, ops@client.com"
            title="Comma-separated login emails. These users only see camps for this Client."
            className={fieldErrors.assignedUserEmails ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors.assignedUserEmails} />
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
        <ClientMasterConsumablesField
          value={form.mappedConsumables}
          onChange={(value) => updateField('mappedConsumables', value)}
        />
      </div>

      <ClientMasterCampTermsBox
        form={form}
        fieldErrors={fieldErrors}
        disabled={loading}
        pendingFiles={pendingCampTermsFiles}
        pendingPoFiles={pendingPoFiles}
        fileBusy={campTermsFileBusy}
        canDeleteFile={isSuperAdmin()}
        onFieldChange={updateField}
        onAddPurchaseOrder={addPurchaseOrder}
        onRemovePurchaseOrder={removePurchaseOrder}
        onPurchaseOrderChange={updatePurchaseOrder}
        onFilesSelect={handleCampTermsFilesSelect}
        onFilesClearPending={() => setPendingCampTermsFiles([])}
        onFilePreview={handleCampTermsFilePreview}
        onFileDelete={handleCampTermsFileDelete}
        onPoFilesSelect={handlePoFilesSelect}
        onPoFilesClearPending={(poId) => {
          setPendingPoFiles((prev) => {
            if (!prev[poId]) return prev;
            const next = { ...prev };
            delete next[poId];
            return next;
          });
        }}
        onPoFilePreview={handlePoFilePreview}
        onPoFileDelete={handlePoFileDelete}
      />

      <div className="form-actions">
        <button type="button" className="btn secondary" onClick={() => navigate(clientMasterListPath())}>Cancel</button>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update Configuration' : 'Create Configuration'}
        </button>
      </div>
    </form>
  );
}
