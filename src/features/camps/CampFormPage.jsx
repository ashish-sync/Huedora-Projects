import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { campApi, clientApi, clientMasterApi } from './campOpsApi.js';
import { api } from '../../shared/api.js';
import { trimFormStrings } from './utils/trimInput';
import { toApiDateValue } from './utils/dateFormat';
import { computeDurationHours } from './utils/campSchedule';
import { FormPageHeader } from './components/FormPageHeader';
import { CampLifecycleForm } from './components/CampLifecycleForm';
import { CampRowInfoMenu } from './components/CampRowInfoMenu';
import { CampActionConfirmModal } from './components/CampActionConfirmModal';
import { buildClosureDetails } from './constants/campClosure';
import { buildSourcePreview } from './utils/formatSourceMessage';
import {
  parseClientMasterDivisions,
  pickSingleOption,
  resolveCampNameOptions,
} from './utils/clientMasterCascade';
import {
  canEditLifecycleStage,
  campToForm,
  emptyLifecycleForm,
  maxLifecycleStage,
  resolveCampSlot,
  hasReachedLifecycleStage,
  todayIsoDate,
} from './constants/campLifecycle';
import { useCampWorkingStage } from './CampWorkingStageContext.jsx';
import { validateRequestStageForm } from './utils/validateRequestStage';

const EDITABLE_STATUSES = ['pending_review', 'approved', 'rejected'];
const NO_DIVISION_MESSAGE = 'Create business unit / division first in Master One → Client Master before creating a camp.';
const NO_METHOD_MESSAGE = 'Configure method in Master One → Client Master for this client and division.';

const formStringFields = [
  'campaignName', 'campaignType', 'doctorName', 'doctorCode', 'campAddress', 'city', 'state',
  'pincode', 'startTime', 'endTime', 'fieldPersonName', 'fieldPersonPhone', 'remarks',
  'hq', 'zone', 'hcwCategory', 'hcwName', 'hcwContact', 'hcwContactId', 'cancellationReason', 'chargeableStatus',
  'inTime', 'outTime', 'punctuality', 'attire', 'transactionId', 'paymentRemark',
  'assignmentStatus', 'assignmentDecision', 'assignmentRefusalReason', 'executionStatus', 'source', 'requestDate',
];

function filterApprovalBlockers(blockers, form, campNameOptions) {
  const campDivision = String(form.campaignType || '').trim();
  const campCampName = String(form.campaignName || '').trim();
  const hasValidDivision = Boolean(campDivision);
  const hasValidCampName = campNameOptions.includes(campCampName);

  return (blockers || []).filter((message) => {
    if (message.includes('division / business unit')) return !hasValidDivision;
    if (message.includes('valid camp name') || message.includes('valid method')) return !hasValidCampName;
    if (message.includes('No matching program in Client Master')) return !(hasValidDivision && hasValidCampName);
    return true;
  });
}

export default function CampFormPage() {
  const { id } = useParams();
  const { canEditCampRecord, hasPermission, canRejectCamps, isSuperAdmin } = useAuth();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { workingStage } = useCampWorkingStage();
  const [clients, setClients] = useState([]);
  const [divisionPrograms, setDivisionPrograms] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [form, setForm] = useState(emptyLifecycleForm);
  const [activeStage, setActiveStage] = useState('request');
  const [campMeta, setCampMeta] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [hcwContacts, setHcwContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [confirmClosureDetails, setConfirmClosureDetails] = useState(null);
  const [confirmReasonDetails, setConfirmReasonDetails] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const hcwContactsLoadedRef = useRef(false);

  const campStatus = campMeta?.status || 'pending_review';

  function applyCampAccess(camp) {
    const loadedStage = camp.lifecycleStage || 'request';
    const preferredStage = workingStage && hasReachedLifecycleStage(loadedStage, workingStage)
      ? workingStage
      : loadedStage;
    setActiveStage(preferredStage);

    const assignmentEditable = hasReachedLifecycleStage(loadedStage, 'assignment')
      && camp.status === 'approved'
      && canEditLifecycleStage(camp.status, 'assignment', loadedStage);

    if (!canEditCampRecord(camp) && !assignmentEditable) {
      setReadOnly(true);
      return;
    }

    setReadOnly(
      assignmentEditable
        ? false
        : (!EDITABLE_STATUSES.includes(camp.status) && camp.status !== 'executed'),
    );
  }

  const reachedLifecycleStage = campMeta?.lifecycleStage || form.lifecycleStage || 'request';

  useEffect(() => {
    if (!isEdit) {
      setForm((prev) => ({ ...prev, requestDate: todayIsoDate() }));
    }
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit && workingStage) {
      setActiveStage(workingStage);
      setForm((prev) => ({ ...prev, lifecycleStage: workingStage }));
    }
  }, [isEdit, workingStage]);

  useEffect(() => {
    if (activeStage !== 'assignment' && workingStage !== 'assignment') return undefined;
    if (hcwContactsLoadedRef.current) return undefined;
    let cancelled = false;
    setContactsLoading(true);
    api('/contacts?limit=500')
      .then((res) => {
        if (!cancelled) {
          setHcwContacts(res.data || []);
          hcwContactsLoadedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) setHcwContacts([]);
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStage, workingStage]);

  useEffect(() => {
    Promise.all([
      clientApi.list({ limit: 500, page: 1 }),
      clientMasterApi.list({ limit: 500, page: 1 }),
    ])
      .then(([clientRes, masterRes]) => {
        const allClients = Array.isArray(clientRes.data?.data) ? clientRes.data.data : [];
        const masters = Array.isArray(masterRes.data?.data) ? masterRes.data.data : [];
        const configuredClientIds = new Set(
          masters.map((row) => row.client?._id || row.clientId || row.client).filter(Boolean).map(String),
        );
        setClients(
          configuredClientIds.size
            ? allClients.filter((client) => configuredClientIds.has(String(client._id)))
            : allClients,
        );
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setDivisionPrograms([]);
      setDivisionOptions([]);
      return undefined;
    }

    let cancelled = false;
    setProgramsLoading(true);
    clientMasterApi.listDivisionsByClient(form.clientId)
      .then(({ data }) => {
        if (cancelled) return;
        const { programs, divisions } = parseClientMasterDivisions(data);
        setDivisionPrograms(programs);
        setDivisionOptions(divisions);
        if (!isEdit) {
          setForm((prev) => {
            const nextDivision = prev.campaignType && divisions.includes(prev.campaignType)
              ? prev.campaignType
              : pickSingleOption(divisions);
            const campNames = resolveCampNameOptions(programs, nextDivision);
            const nextCampName = prev.campaignName && campNames.includes(prev.campaignName)
              ? prev.campaignName
              : pickSingleOption(campNames);
            return { ...prev, campaignType: nextDivision, campaignName: nextCampName };
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDivisionPrograms([]);
          setDivisionOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false);
      });

    return () => { cancelled = true; };
  }, [form.clientId, isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return undefined;

    let cancelled = false;
    setFetching(true);
    setError('');
    campApi.get(id)
      .then(({ data }) => {
        if (cancelled) return;
        const camp = data.data;
        setCampMeta({
          _id: camp._id,
          campId: camp.campId,
          status: camp.status,
          source: camp.source,
          approvalBlockers: camp.approvalBlockers || [],
          canApprove: camp.canApprove !== false,
          emailSubject: camp.emailSubject,
          emailSender: camp.emailSender,
          emailRawBody: camp.emailRawBody,
          whatsappSenderPhone: camp.whatsappSenderPhone,
          whatsappRawMessage: camp.whatsappRawMessage,
          submittedAt: camp.submittedAt || camp.createdAt,
          requestReviewStatus: camp.requestReviewStatus || '',
          requestReviewStatusLabel: camp.requestReviewStatusLabel || '',
          informationRequestNote: camp.informationRequestNote || '',
          lifecycleStage: camp.lifecycleStage || 'request',
          rejectionReason: camp.rejectionReason || '',
          cancellationReason: camp.cancellationReason || '',
          closureReasonCode: camp.closureReasonCode || '',
          assignmentRefusalReason: camp.assignmentRefusalReason || '',
          cancelledBy: camp.cancelledBy || '',
          remarks: camp.remarks || '',
          clientName: camp.clientName || '',
          campaignName: camp.campaignName || '',
          campaignType: camp.campaignType || '',
        });
        setForm(campToForm(camp));
        applyCampAccess(camp);
        if (!canEditCampRecord(camp) && !(workingStage === 'assignment' && camp.status === 'approved')) {
          setError('You can only edit camps that are pending review.');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load camp');
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
    // Load camp once per id — stage/permission changes are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit || !campMeta) return;
    applyCampAccess({
      status: campMeta.status,
      lifecycleStage: campMeta.lifecycleStage,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingStage, campMeta?.status, campMeta?.lifecycleStage, isEdit]);

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'clientId') {
        next.campaignType = '';
        next.campaignName = '';
      }
      if (field === 'campaignType') {
        const campNames = resolveCampNameOptions(divisionPrograms, value);
        next.campaignName = pickSingleOption(campNames);
      }
      if (field === 'startTime' || field === 'endTime') {
        const start = field === 'startTime' ? value : next.startTime;
        const end = field === 'endTime' ? value : next.endTime;
        if (start && end) {
          next.durationHours = computeDurationHours(start, end);
        }
        if (start) {
          next.campSlot = resolveCampSlot(start);
        }
      }
      if (field === 'inTime' || field === 'outTime') {
        next.lifecycleStage = next.lifecycleStage || 'execution';
      }
      return next;
    });
  }

  function updateFields(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleUploadDocuments(fileList, docType) {
    if (!id || !fileList?.length) return;
    setUploadBusy(true);
    setError('');
    try {
      const { data } = await campApi.uploadExecutionDocuments(id, fileList, docType);
      setForm(campToForm(data.data));
    } catch (err) {
      setError(err?.message || 'Failed to upload documents');
    } finally {
      setUploadBusy(false);
    }
  }

  function openCampActionConfirm(action) {
    setConfirmRequest({
      mode: 'single',
      action,
      camp: campMeta,
    });
    setConfirmClosureDetails(action === 'closeCamp' ? buildClosureDetails() : null);
    setConfirmReasonDetails(['reject', 'requestInformation'].includes(action) ? { reason: '' } : null);
    setError('');
  }

  function closeCampActionConfirm() {
    if (confirmLoading) return;
    setConfirmRequest(null);
    setConfirmClosureDetails(null);
    setConfirmReasonDetails(null);
  }

  async function executeCampActionConfirm() {
    if (!confirmRequest || !id) return;

    setConfirmLoading(true);
    setError('');
    try {
      const { action } = confirmRequest;
      const payload = action === 'closeCamp'
        ? {
          closureType: confirmClosureDetails.closureType,
          reasonCode: confirmClosureDetails.reasonCode,
        }
        : action === 'reject'
          ? { rejectionReason: confirmReasonDetails?.reason?.trim() || '' }
          : action === 'requestInformation'
            ? { informationRequestNote: confirmReasonDetails?.reason?.trim() || '' }
            : {};

      const handlers = {
        closeCamp: campApi.close,
        reject: campApi.reject,
        requestInformation: campApi.requestInformation,
        delete: campApi.delete,
      };
      const handler = handlers[action];
      if (!handler) throw new Error(`Unsupported camp action: ${action}`);

      if (action === 'delete') {
        await handler(id);
        navigate('/camps/manage');
        return;
      }

      const { data } = await handler(id, payload);
      const camp = data.data;
      setCampMeta((prev) => ({
        ...prev,
        status: camp.status,
        requestReviewStatus: camp.requestReviewStatus || '',
        requestReviewStatusLabel: camp.requestReviewStatusLabel || '',
        informationRequestNote: camp.informationRequestNote || '',
        rejectionReason: camp.rejectionReason || '',
        cancellationReason: camp.cancellationReason || '',
        closureReasonCode: camp.closureReasonCode || '',
        assignmentRefusalReason: camp.assignmentRefusalReason || '',
        cancelledBy: camp.cancelledBy || '',
        remarks: camp.remarks || '',
      }));
      setForm(campToForm(camp));
      applyCampAccess(camp);
      setConfirmRequest(null);
      setConfirmClosureDetails(null);
      setConfirmReasonDetails(null);

      if (action === 'closeCamp') {
        navigate('/camps/manage');
      }
    } catch (err) {
      setError(err?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
    }
  }

  function requestCampAction(_campId, action) {
    openCampActionConfirm(action);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (readOnly && campStatus === 'cancelled') return;

    if (activeStage === 'request' || !isEdit) {
      const requestErrors = validateRequestStageForm(form);
      if (requestErrors.length) {
        setError(requestErrors[0]);
        return;
      }
      if (!divisionOptions.length) {
        setError(NO_DIVISION_MESSAGE);
        return;
      }
      const campNameOptionsForSave = resolveCampNameOptions(divisionPrograms, form.campaignType, form.campaignName);
      if (!campNameOptionsForSave.length) {
        setError(NO_METHOD_MESSAGE);
        return;
      }
      if (!campNameOptionsForSave.includes(form.campaignName)) {
        setError('Please select a method configured for this client and division');
        return;
      }
    }

    if (activeStage === 'assignment') {
      if (!form.assignmentDecision) {
        setError('Select Assign or Refuse');
        return;
      }
      if (form.assignmentDecision === 'assign') {
        if (!form.hcwContactId) {
          setError('Select an HCW from Contact Directory');
          return;
        }
        if (!form.hcwCategory || !form.hcwName || !form.hcwContact) {
          setError('HCW Category, Name, and Contact are required when assigning');
          return;
        }
      }
      if (form.assignmentDecision === 'refuse' && !String(form.assignmentRefusalReason || '').trim()) {
        setError('Select a refusal reason');
        return;
      }
    }

    const trimmed = trimFormStrings(form, formStringFields);
    const payload = {
      ...form,
      ...trimmed,
      clientId: form.clientId,
      campDate: toApiDateValue(form.campDate),
      requestDate: isEdit
        ? (toApiDateValue(form.requestDate) || form.requestDate)
        : todayIsoDate(),
      durationHours: form.durationHours,
      expectedPatients: form.expectedPatients,
      patientsCount: form.patientsCount,
      editingStage: activeStage,
      lifecycleStage: isEdit
        ? maxLifecycleStage(reachedLifecycleStage, activeStage)
        : activeStage,
      lifecycleOnly: isEdit && activeStage !== 'request',
    };

    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await campApi.update(id, payload);
      } else {
        await campApi.create(payload);
      }
      navigate('/camps/manage');
    } catch (err) {
      setError(err?.message || 'Failed to save camp');
    } finally {
      setLoading(false);
    }
  }

  const campNameOptions = useMemo(
    () => resolveCampNameOptions(divisionPrograms, form.campaignType, form.campaignName),
    [divisionPrograms, form.campaignType, form.campaignName],
  );

  const stageReadOnly = useMemo(() => ({
    request: readOnly || !canEditLifecycleStage(campStatus, 'request', reachedLifecycleStage),
    assignment: readOnly || !canEditLifecycleStage(campStatus, 'assignment', reachedLifecycleStage),
    execution: readOnly || !canEditLifecycleStage(campStatus, 'execution', reachedLifecycleStage),
    financial: readOnly || !canEditLifecycleStage(campStatus, 'financial', reachedLifecycleStage),
  }), [readOnly, campStatus, reachedLifecycleStage]);

  if (fetching) {
    return <div className="empty-state">Loading camp...</div>;
  }

  if (!isEdit && !hasPermission('camps:create')) {
    return (
      <div className="empty-state">
        <p>You do not have permission to create camps.</p>
        <button type="button" className="btn secondary" onClick={() => navigate('/camps/manage')}>
          Back to camps
        </button>
      </div>
    );
  }

  const visibleApprovalBlockers = campMeta?.status === 'pending_review' && campMeta.canApprove === false
    ? filterApprovalBlockers(campMeta.approvalBlockers, form, campNameOptions)
    : [];

  const hasNoDivisions = Boolean(form.clientId) && !programsLoading && divisionOptions.length === 0;
  const hasNoMethods = Boolean(form.clientId) && Boolean(form.campaignType) && !programsLoading && campNameOptions.length === 0;
  const canSubmit = campStatus !== 'cancelled'
    && campStatus !== 'rejected'
    && canEditLifecycleStage(campStatus, activeStage, reachedLifecycleStage)
    && (!hasNoDivisions || activeStage !== 'request')
    && (!hasNoMethods || activeStage !== 'request')
    && (activeStage !== 'assignment' || ['approved', 'executed'].includes(campStatus));

  return (
    <form className="form-card camp-lifecycle-page" onSubmit={handleSubmit}>
      <div className="camp-form-header-row">
        <FormPageHeader title={isEdit ? 'Edit Camp' : 'Create Camp'} backTo="/camps/manage" />
        {isEdit && campMeta && (
          <CampRowInfoMenu
            camp={campMeta}
            hasPermission={hasPermission}
            canRejectCamps={canRejectCamps()}
            isSuperAdmin={isSuperAdmin}
            onAction={requestCampAction}
          />
        )}
      </div>

      {campMeta && (
        <div className="meta-text camp-form-meta">
          <div><strong>Camp ID:</strong> {campMeta.campId}</div>
          <div><strong>Status:</strong> {campMeta.status.replaceAll('_', ' ')}</div>
        </div>
      )}

      <div className="camp-form-alerts">
        {campMeta?.requestReviewStatus === 'information_requested' && (
          <div className="error-banner">
            Reviewer requested more information
            {campMeta.informationRequestNote ? `: ${campMeta.informationRequestNote}` : '.'}
            {' '}Update the request and save to resubmit for review.
          </div>
        )}
        {visibleApprovalBlockers.length > 0 && (
          <div className="error-banner">
            Cannot approve until resolved: {visibleApprovalBlockers.join(' ')}
          </div>
        )}
        {hasNoDivisions && activeStage === 'request' && (
          <div className="error-banner">{NO_DIVISION_MESSAGE}</div>
        )}
        {hasNoMethods && activeStage === 'request' && (
          <div className="error-banner">{NO_METHOD_MESSAGE}</div>
        )}
        {error && <div className="error-banner">{error}</div>}
      </div>

      {isEdit && campMeta && (campMeta.source === 'email' || campMeta.source === 'whatsapp') && (
        <div className="camp-form-source-section">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSourcePreview((o) => !o)}>
            {showSourcePreview ? 'Hide' : 'View'} original {campMeta.source}
          </button>
          {showSourcePreview && (
            <div className="form-card camp-source-preview-card">
              <pre className="camp-source-preview-text">{buildSourcePreview(campMeta) || 'No original message stored.'}</pre>
            </div>
          )}
        </div>
      )}

      <CampLifecycleForm
        form={form}
        updateField={updateField}
        updateFields={updateFields}
        activeStage={activeStage}
        onStageChange={setActiveStage}
        campStatus={campStatus}
        clients={clients}
        divisionOptions={divisionOptions}
        campNameOptions={campNameOptions}
        programsLoading={programsLoading}
        stageReadOnly={stageReadOnly}
        campId={isEdit ? id : null}
        onUploadDocuments={handleUploadDocuments}
        uploadBusy={uploadBusy}
        hcwContacts={hcwContacts}
        contactsLoading={contactsLoading}
        clientName={campMeta?.clientName || ''}
        onValidationError={setError}
        reachedLifecycleStage={reachedLifecycleStage}
      />

      <div className="form-actions">
        {canSubmit && (
          <button className="btn btn-primary" type="submit" disabled={loading || uploadBusy}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Camp'}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/camps/manage')}>
          Cancel
        </button>
      </div>

      <CampActionConfirmModal
        request={confirmRequest}
        closureDetails={confirmClosureDetails}
        onClosureDetailsChange={setConfirmClosureDetails}
        reasonDetails={confirmReasonDetails}
        onReasonDetailsChange={setConfirmReasonDetails}
        onConfirm={executeCampActionConfirm}
        onCancel={closeCampActionConfirm}
        loading={confirmLoading}
      />
    </form>
  );
}
