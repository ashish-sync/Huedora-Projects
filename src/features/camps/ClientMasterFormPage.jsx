import { useEffect, useMemo, useRef, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { useSuppressBrowserAutofill, AutofillDecoyFields } from '../../shared/suppressBrowserAutofill.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { ClientMasterCampTermsBox } from './components/ClientMasterCampTermsBox.jsx';
import { ClientMasterFormSectionFields } from './components/ClientMasterFormSections.jsx';
import { ClientMasterSectionCard } from './components/ClientMasterSectionCard.jsx';
import { clientMasterApi } from './campOpsApi.js';
import { clientMasterEditPath, clientMasterListPath } from './clientMasterPaths.js';
import {
  CAMP_TERMS,
  campTermsFilesFromRecord,
  campTermsFieldsFromRecord,
  combinePurchaseOrders,
  computePoTaxFields,
  createEmptyPurchaseOrder,
  emptyCampTermsFormFields,
  mergePoFilesFromServerRecord,
  normalizeCampTerms,
  poAmountInputValue,
  purchaseOrdersFromRecord,
  validateCampTermsFile,
} from './utils/clientMasterPo.js';
import {
  CLIENT_MASTER_SECTIONS,
  buildSectionPayload,
  buildSectionSummary,
  restoreSectionFromSnapshot,
  validateClientMasterSection,
  validateSectionsForCreate,
} from './utils/clientMasterSections.js';
import {
  hasValidationErrors,
  recordToForm,
} from './utils/clientMasterValidation';
import {
  parseClientMasterListResponse,
  resolveClientMasterAssignedUserEmails,
} from './utils/clientMasterCascade.js';

const emptyForm = {
  clientId: '',
  clientName: '',
  clientCode: '',
  displayName: '',
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

function sectionFieldErrors(sectionId, allErrors) {
  const section = CLIENT_MASTER_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return {};
  const picked = {};
  Object.entries(allErrors || {}).forEach(([key, message]) => {
    if (section.fields.includes(key)) {
      picked[key] = message;
      return;
    }
    if (sectionId === 'campTerms' && (key.startsWith('purchaseOrders') || key === 'campTermsFiles')) {
      picked[key] = message;
    }
  });
  return picked;
}

export default function ClientMasterFormPage() {
  const { id: routeId } = useParams();
  const { hasPermission, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const canCreateCompany = hasPermission('clients:create');

  const [recordId, setRecordId] = useState(routeId || '');
  const isPersisted = Boolean(recordId);
  const isEditRoute = Boolean(routeId);

  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(isEditRoute);
  const [activeSection, setActiveSection] = useState(isEditRoute ? null : 'clientInfo');
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [sectionSaving, setSectionSaving] = useState(false);
  const [pendingCampTermsFiles, setPendingCampTermsFiles] = useState([]);
  const [pendingPoFiles, setPendingPoFiles] = useState({});
  const [campTermsFileBusy, setCampTermsFileBusy] = useState(false);
  const [clientMasterRecords, setClientMasterRecords] = useState([]);
  const assignedUsersTouchedRef = useRef(false);
  const programScopeKeyRef = useRef('');
  const formRef = useRef(null);
  useSuppressBrowserAutofill(formRef);

  useEffect(() => {
    setRecordId(routeId || '');
  }, [routeId]);

  useEffect(() => {
    if (!isEditRoute) return undefined;

    setFetching(true);
    clientMasterApi.get(routeId)
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
  }, [routeId, isEditRoute]);

  useEffect(() => {
    const clientId = String(form.clientId || '').trim();
    const clientName = String(form.clientName || '').trim();
    if (!clientId && !clientName) {
      setClientMasterRecords([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = clientId
          ? await clientMasterApi.listByClient(clientId, clientName ? { clientName } : undefined)
          : { data: { data: [] } };
        if (!cancelled) {
          setClientMasterRecords(parseClientMasterListResponse(res));
        }
      } catch {
        if (!cancelled) setClientMasterRecords([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.clientId, form.clientName]);

  const mappedAssignedUserEmails = useMemo(
    () => resolveClientMasterAssignedUserEmails(clientMasterRecords, {
      programName: form.programName,
      campName: form.campName,
    }),
    [clientMasterRecords, form.programName, form.campName],
  );

  useEffect(() => {
    const key = [form.clientName, form.programName, form.campName].join('\0');
    if (programScopeKeyRef.current && programScopeKeyRef.current !== key) {
      assignedUsersTouchedRef.current = false;
    }
    programScopeKeyRef.current = key;
  }, [form.clientName, form.programName, form.campName]);

  function updateField(field, value) {
    setForm((prev) => {
      if (field !== 'campTerms') {
        return { ...prev, [field]: value };
      }
      const nextTerms = normalizeCampTerms(value);
      const next = { ...prev, campTerms: nextTerms };
      if (nextTerms === CAMP_TERMS.PO_BASED || nextTerms === CAMP_TERMS.AGREEMENT_BASED) {
        const orders = Array.isArray(prev.purchaseOrders) ? prev.purchaseOrders : [];
        if (!orders.length) next.purchaseOrders = [createEmptyPurchaseOrder()];
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
        (row) => row.id !== poId,
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
          const entered = field === 'poApplyGst18' ? poAmountInputValue(row) : value;
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

  function updateAssignedUserEmails(value) {
    assignedUsersTouchedRef.current = true;
    updateField('assignedUserEmails', value);
  }

  function sectionRequiresRecord(sectionId) {
    return ['spoc', 'commercial', 'campTerms'].includes(sectionId);
  }

  function isSectionLocked(sectionId) {
    if (activeSection && activeSection !== sectionId) return true;
    if (!isPersisted && sectionRequiresRecord(sectionId)) return true;
    return false;
  }

  function beginSectionEdit(sectionId) {
    if (isSectionLocked(sectionId) && sectionRequiresRecord(sectionId) && !isPersisted) {
      setError('Save Program Configuration first to create this record.');
      return;
    }
    if (activeSection && activeSection !== sectionId) return;
    setEditSnapshot(JSON.parse(JSON.stringify(form)));
    if (sectionId === 'spoc' && mappedAssignedUserEmails.length && !assignedUsersTouchedRef.current) {
      setForm((prev) => ({
        ...prev,
        assignedUserEmails: mappedAssignedUserEmails.join(', '),
      }));
    }
    setActiveSection(sectionId);
    setFieldErrors({});
    setError('');
  }

  function cancelSectionEdit() {
    if (editSnapshot && activeSection) {
      setForm(restoreSectionFromSnapshot(form, editSnapshot, activeSection));
      if (activeSection === 'campTerms') {
        setPendingCampTermsFiles([]);
        setPendingPoFiles({});
      }
    }
    setActiveSection(null);
    setEditSnapshot(null);
    setFieldErrors({});
  }

  async function uploadPendingCampFiles(savedId) {
    if (!pendingCampTermsFiles.length || !savedId) return;
    await clientMasterApi.uploadCampTermsFiles(savedId, pendingCampTermsFiles);
    setPendingCampTermsFiles([]);
  }

  async function uploadPendingPoFiles(savedId) {
    const pendingEntries = Object.entries(pendingPoFiles).filter(([, files]) => files?.length);
    if (!pendingEntries.length || !savedId) return;

    let orders = Array.isArray(form.purchaseOrders) ? form.purchaseOrders : [];
    try {
      const { data } = await clientMasterApi.get(savedId);
      orders = purchaseOrdersFromRecord(data.data);
    } catch {
      /* use form orders */
    }

    for (const [poId, files] of pendingEntries) {
      const target =
        orders.find((row) => row.id === poId)
        || orders.find((row) => String(row.poNumber || '') === String(
          (form.purchaseOrders || []).find((p) => p.id === poId)?.poNumber || '',
        ));
      if (!target?.id) continue;
      await clientMasterApi.uploadPoFiles(savedId, files, target.id);
    }
    setPendingPoFiles({});
  }

  async function handleSectionSave(sectionId) {
    const errors = !isPersisted && sectionId === 'program'
      ? validateSectionsForCreate(form)
      : validateClientMasterSection(sectionId, form);

    if (hasValidationErrors(errors)) {
      setFieldErrors(errors);
      setError('Please fix the highlighted fields');
      return;
    }

    if (!canCreateCompany && !form.clientId && (sectionId === 'clientInfo' || sectionId === 'program')) {
      setError('Select an existing company from the search list. New companies can only be created by an administrator.');
      return;
    }

    // Local draft saves before record exists
    if (!isPersisted && (sectionId === 'clientInfo' || sectionId === 'billing')) {
      setActiveSection(null);
      setEditSnapshot(null);
      setFieldErrors({});
      setError('');
      return;
    }

    setSectionSaving(true);
    setError('');
    try {
      let savedId = recordId;

      if (!isPersisted && sectionId === 'program') {
        const payload = buildSectionPayload('program', form, { forCreate: true });
        const { data } = await clientMasterApi.create(payload);
        savedId = data.data._id;
        setRecordId(savedId);
        setForm(recordToForm(data.data));
        await uploadPendingCampFiles(savedId);
        await uploadPendingPoFiles(savedId);
        navigate(clientMasterEditPath(savedId), { replace: true });
      } else {
        const payload = buildSectionPayload(sectionId, form);
        const { data } = await clientMasterApi.update(savedId, payload);
        setForm(recordToForm(data.data));

        if (sectionId === 'campTerms') {
          await uploadPendingCampFiles(savedId);
          await uploadPendingPoFiles(savedId);
          const { data: refreshed } = await clientMasterApi.get(savedId);
          setForm(recordToForm(refreshed.data));
        }
      }

      setActiveSection(null);
      setEditSnapshot(null);
      setFieldErrors({});
      if (sectionId === 'spoc') {
        assignedUsersTouchedRef.current = false;
        if (form.clientId) {
          try {
            const res = await clientMasterApi.listByClient(form.clientId, {
              clientName: form.clientName || undefined,
            });
            setClientMasterRecords(parseClientMasterListResponse(res));
          } catch {
            /* keep existing records */
          }
        }
      }
    } catch (err) {
      setError(err?.message || 'Failed to save section');
    } finally {
      setSectionSaving(false);
    }
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

    if (isPersisted) {
      setCampTermsFileBusy(true);
      try {
        const { data } = await clientMasterApi.uploadCampTermsFiles(recordId, files);
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
    if (!isPersisted || (!file?.id && !file?.storedName)) return;
    try {
      const fileId = file.id || file.storedName;
      const { data: blob } = await clientMasterApi.downloadCampTermsFile(recordId, fileId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err?.message || 'Failed to open file');
    }
  }

  async function handleCampTermsFileDelete(file) {
    if (!isSuperAdmin() || !isPersisted || !file) return;
    if (!window.confirm(`Remove “${file.fileName || 'file'}”?`)) return;
    setCampTermsFileBusy(true);
    try {
      const fileId = file.id || file.storedName;
      const { data } = await clientMasterApi.deleteCampTermsFile(recordId, fileId);
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

    if (isPersisted) {
      setCampTermsFileBusy(true);
      try {
        const { data } = await clientMasterApi.uploadPoFiles(recordId, files, poId);
        setForm((prev) => {
          const orders = mergePoFilesFromServerRecord(prev.purchaseOrders, poId, data.data);
          return {
            ...prev,
            purchaseOrders: orders,
            ...combinePurchaseOrders(orders),
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
    if (!isPersisted || !poId) return;
    try {
      const fileId = file?.id || file?.storedName;
      if (fileId) {
        const { data: blob } = await clientMasterApi.downloadPoFileById(recordId, poId, fileId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      const { data: blob } = await clientMasterApi.downloadPoFile(recordId, poId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err?.message || 'Failed to open PO file');
    }
  }

  async function handlePoFileDelete(poId, file) {
    if (!isSuperAdmin() || !isPersisted || !poId || !file) return;
    if (!window.confirm(`Remove “${file.fileName || 'file'}”?`)) return;
    setCampTermsFileBusy(true);
    try {
      const fileId = file.id || file.storedName;
      const { data } = await clientMasterApi.deletePoFileById(recordId, poId, fileId);
      setForm((prev) => {
        const orders = mergePoFilesFromServerRecord(prev.purchaseOrders, poId, data.data);
        return {
          ...prev,
          purchaseOrders: orders,
          ...combinePurchaseOrders(orders),
        };
      });
    } catch (err) {
      setError(err?.message || 'Failed to remove PO file');
    } finally {
      setCampTermsFileBusy(false);
    }
  }

  if (fetching) {
    return <div className="empty-state">Loading Client Master record...</div>;
  }

  return (
    <div ref={formRef} className="form-card client-master-sections" autoComplete="off" data-form-type="other">
      <AutofillDecoyFields />
      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}

      {!isPersisted ? (
        <p className="meta-text client-master-section-flow-hint">
          Complete Client Information and Billing locally, then save Program Configuration to create the record.
          SPOC, Commercial, and Camp Terms unlock after creation.
        </p>
      ) : null}

      {CLIENT_MASTER_SECTIONS.map((section, index) => {
        const isEditing = activeSection === section.id;
        const editLocked = isSectionLocked(section.id);
        let summary = buildSectionSummary(section.id, form);
        if (section.id === 'spoc') {
          const displayEmails = mappedAssignedUserEmails.length
            ? mappedAssignedUserEmails.join(', ')
            : (form.assignedUserEmails || '—');
          summary = summary.map((row) => (
            row.label === 'Assigned Users' ? { ...row, value: displayEmails || '—' } : row
          ));
        }
        const sectionErrors = sectionFieldErrors(section.id, fieldErrors);

        return (
          <ClientMasterSectionCard
            key={section.id}
            step={index + 1}
            title={section.title}
            description={section.description}
            isEditing={isEditing}
            editLocked={editLocked}
            saving={sectionSaving}
            summary={summary}
            onEdit={() => beginSectionEdit(section.id)}
            onSave={() => handleSectionSave(section.id)}
            onCancel={cancelSectionEdit}
          >
            {section.id === 'campTerms' ? (
              <ClientMasterCampTermsBox
                embedded
                form={form}
                fieldErrors={sectionErrors}
                disabled={sectionSaving || campTermsFileBusy}
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
            ) : (
              <ClientMasterFormSectionFields
                sectionId={section.id}
                form={form}
                fieldErrors={sectionErrors}
                loading={sectionSaving}
                canCreateCompany={canCreateCompany}
                onFieldChange={updateField}
                onClientNameChange={updateClientName}
                onSelectRecord={applySuggestion}
                onAssignedUsersChange={updateAssignedUserEmails}
                programScopeLabel={
                  form.clientName && form.programName && form.campName
                    ? `${form.clientName} · ${form.programName} · ${form.campName}`
                    : ''
                }
              />
            )}
          </ClientMasterSectionCard>
        );
      })}

      <div className="form-actions">
        <button type="button" className="btn secondary" onClick={() => navigate(clientMasterListPath())}>
          {isPersisted ? 'Back to list' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
