import { useEffect, useMemo, useRef, useState } from 'react';
import { PageAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { useSuppressBrowserAutofill, AutofillDecoyFields } from '../../shared/suppressBrowserAutofill.js';
import { campApi, clientApi, clientMasterApi } from './campOpsApi.js';
import { api } from '../../shared/api.js';
import { trimFormStrings } from './utils/trimInput';
import { toApiDateValue } from './utils/dateFormat';
import { computeDurationHours } from './utils/campSchedule';
import { X } from 'lucide-react';
import { FormPageHeader } from './components/FormPageHeader';
import { CampLifecycleForm } from './components/CampLifecycleForm';
import { CampRowInfoMenu } from './components/CampRowInfoMenu';
import { CampRowIconButton } from './components/CampRowIconButton';
import { CampActionConfirmModal } from './components/CampActionConfirmModal';
import { buildClosureDetails, buildClosurePayload } from './constants/campClosure';
import { buildSourcePreview } from './utils/formatSourceMessage';
import { fetchAllHealthcareWorkerContacts } from './utils/fetchHcwContacts.js';
import {
  parseClientMasterDivisions,
  applyClientMasterCascade,
  pickSingleOption,
  resolveCampNameOptions,
  resolveClientMasterHealthcareWorkers,
  diagnoseClientMasterHcwGap,
  parseClientMasterListResponse,
} from './utils/clientMasterCascade';
import {
  canEditLifecycleStage,
  campToForm,
  emptyLifecycleForm,
  maxLifecycleStage,
  resolveCampSlot,
  hasReachedLifecycleStage,
  canVisitLifecycleStage,
  isExecutionReadyForFinance,
  getExecutionFinanceBlockers,
  getExecutionConsumablesBlockers,
  todayIsoDate,
  syncExecutionStatusForSave,
  EXECUTION_STATUS,
  normalizeExecutionStatus,
  normalizeLifecycleStage,
} from './constants/campLifecycle';
import { useCampWorkingStage } from './CampWorkingStageContext.jsx';
import { validateRequestStageForm } from './utils/validateRequestStage';
import { confirmCampDurationIfNeeded } from './utils/campDurationWarning';
import { findHcwAssignmentGapConflict } from './utils/hcwAssignmentGap.js';
import { HcwAssignmentGapAlert } from './components/HcwAssignmentGapAlert.jsx';
import { syncPrimaryContactFields, normalizeContactPersons } from './utils/campContactPersons.js';
import { mergeConsumablesWithTemplate, normalizeConsumablesUsed } from './utils/campConsumables.js';
import { getHcwFinanceBlockers, isHcwReadyForFinance } from './utils/hcwFinanceReadiness.js';
import { embeddedServiceProviderId, resolveCampPayoutPayee } from './utils/campPayoutPayee.js';
import { findAssignableHealthcareWorker } from './utils/campHcwContact.js';

const EDITABLE_STATUSES = ['pending_review', 'approved', 'rejected'];
const NO_DIVISION_MESSAGE = 'Create business unit / division first in Master One → Client Master before creating a camp.';
const NO_METHOD_MESSAGE = 'Configure method in Master One → Client Master for this Client and division.';

const formStringFields = [
  'campaignName', 'campaignType', 'doctorName', 'doctorCode', 'campAddress', 'city', 'state', 'district',
  'pincode', 'latitude', 'longitude', 'googlePlaceId', 'startTime', 'endTime', 'contactPersonLevel', 'fieldPersonName', 'fieldPersonPhone', 'remarks',
  'hq', 'zone', 'hcwCategory', 'hcwName', 'hcwContact', 'hcwContactId', 'cancellationReason', 'chargeableStatus',
  'inTime', 'outTime', 'attire', 'labCoat', 'transactionId', 'paymentRemark',
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
  const { canEditCampRecord, hasPermission, canSetHistoricalCampDates } = useAuth();
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
  const [hcwGapConflict, setHcwGapConflict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [submitFinanceBusy, setSubmitFinanceBusy] = useState(false);
  const [downloadFinanceBusy, setDownloadFinanceBusy] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [hcwContacts, setHcwContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [assignedHcwContact, setAssignedHcwContact] = useState(null);
  const [assignedHcwLoading, setAssignedHcwLoading] = useState(false);
  const [payoutPayeeContact, setPayoutPayeeContact] = useState(null);
  const [payoutPayeeLoading, setPayoutPayeeLoading] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [confirmClosureDetails, setConfirmClosureDetails] = useState(null);
  const [confirmReasonDetails, setConfirmReasonDetails] = useState(null);
  const formRef = useRef(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mappedConsumables, setMappedConsumables] = useState([]);
  const [clientMasterRecords, setClientMasterRecords] = useState([]);
  const [clientMasterLoading, setClientMasterLoading] = useState(false);
  const [clientMasterLoadFailed, setClientMasterLoadFailed] = useState(false);
  const hcwContactsLoadedRef = useRef(false);

  const campStatus = campMeta?.status || 'pending_review';

  function applyCampAccess(camp) {
    const loadedStage = normalizeLifecycleStage(camp.lifecycleStage, 'request');
    const preferredStage = workingStage && canVisitLifecycleStage(loadedStage, workingStage)
      ? normalizeLifecycleStage(workingStage, loadedStage)
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

  const reachedLifecycleStage = normalizeLifecycleStage(
    campMeta?.lifecycleStage || form.lifecycleStage,
    'request',
  );

  useEffect(() => {
    if (!isEdit) {
      setForm((prev) => ({ ...prev, requestDate: todayIsoDate(), lifecycleStage: 'request' }));
      setActiveStage('request');
    }
  }, [isEdit]);

  useEffect(() => {
    const needsHcwContacts = activeStage === 'assignment'
      || workingStage === 'assignment'
      || activeStage === 'financial'
      || workingStage === 'financial';
    if (!needsHcwContacts) return undefined;
    if (hcwContactsLoadedRef.current) return undefined;
    let cancelled = false;
    setContactsLoading(true);
    fetchAllHealthcareWorkerContacts()
      .then((contacts) => {
        if (!cancelled) {
          setHcwContacts(contacts);
          hcwContactsLoadedRef.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHcwContacts([]);
          setError(err?.message || 'Failed to load Healthcare Worker contacts');
        }
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStage, workingStage]);

  useEffect(() => {
    if (!isEdit || activeStage !== 'financial' || !form.hcwContactId) {
      setAssignedHcwContact(null);
      return undefined;
    }

    const cached = findAssignableHealthcareWorker(hcwContacts, form.hcwContactId);
    if (cached) {
      setAssignedHcwContact(cached);
      return undefined;
    }

    if (embeddedServiceProviderId(form.hcwContactId)) {
      setAssignedHcwContact(null);
      return undefined;
    }

    let cancelled = false;
    setAssignedHcwLoading(true);
    api(`/contacts/${form.hcwContactId}`)
      .then((res) => {
        if (!cancelled) setAssignedHcwContact(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setAssignedHcwContact(null);
      })
      .finally(() => {
        if (!cancelled) setAssignedHcwLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, activeStage, form.hcwContactId, hcwContacts]);

  useEffect(() => {
    if (!isEdit || activeStage !== 'financial' || !assignedHcwContact) {
      setPayoutPayeeContact(null);
      setPayoutPayeeLoading(false);
      return undefined;
    }

    const resolved = resolveCampPayoutPayee(assignedHcwContact, hcwContacts);
    if (resolved.payeeContact) {
      setPayoutPayeeContact(resolved.payeeContact);
      setPayoutPayeeLoading(false);
      return undefined;
    }

    if (!resolved.payeeIsServiceProvider || !resolved.payeeContactId) {
      setPayoutPayeeContact(assignedHcwContact);
      setPayoutPayeeLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPayoutPayeeLoading(true);
    api(`/contacts/${resolved.payeeContactId}`)
      .then((res) => {
        if (!cancelled) setPayoutPayeeContact(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setPayoutPayeeContact(null);
      })
      .finally(() => {
        if (!cancelled) setPayoutPayeeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, activeStage, assignedHcwContact, hcwContacts]);

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
    clientMasterApi.listDivisionsByClient(
      form.clientId,
      form.clientName ? { clientName: form.clientName } : undefined,
    )
      .then(({ data }) => {
        if (cancelled) return;
        const { programs, divisions } = parseClientMasterDivisions(data);
        setDivisionPrograms(programs);
        setDivisionOptions(divisions);
        setForm((prev) => {
          const cascaded = applyClientMasterCascade({
            programs,
            currentDivision: prev.campaignType,
            currentMethod: prev.campaignName,
          });
          if (
            cascaded.campaignType === prev.campaignType
            && cascaded.campaignName === prev.campaignName
          ) {
            return prev;
          }
          return {
            ...prev,
            campaignType: cascaded.campaignType,
            campaignName: cascaded.campaignName,
          };
        });
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
  }, [form.clientId, form.clientName]);

  useEffect(() => {
    if (!form.clientId && !form.clientName) {
      setMappedConsumables([]);
      setClientMasterRecords([]);
      setClientMasterLoadFailed(false);
      setClientMasterLoading(false);
      return undefined;
    }

    let cancelled = false;
    setClientMasterLoading(true);
    setClientMasterLoadFailed(false);
    campApi.consumablesForCamp(form.clientId, {
      campaignType: form.campaignType,
      campaignName: form.campaignName,
      clientName: form.clientName || undefined,
    })
      .then(({ data }) => {
        if (!cancelled) setMappedConsumables(data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setMappedConsumables([]);
      });

    clientMasterApi.listByClient(
      form.clientId || encodeURIComponent(form.clientName),
      form.clientName ? { clientName: form.clientName } : undefined,
    )
      .then((response) => {
        if (cancelled) return;
        setClientMasterRecords(parseClientMasterListResponse(response));
        setClientMasterLoadFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setClientMasterRecords([]);
        setClientMasterLoadFailed(true);
        setError(err?.message || 'Failed to load Client Master for this camp');
      })
      .finally(() => {
        if (!cancelled) setClientMasterLoading(false);
      });

    return () => { cancelled = true; };
  }, [form.clientId, form.clientName, form.campaignType, form.campaignName]);

  useEffect(() => {
    if (!mappedConsumables.length) return undefined;
    setForm((prev) => {
      const merged = mergeConsumablesWithTemplate(mappedConsumables, prev.consumablesUsed);
      if (JSON.stringify(merged) === JSON.stringify(prev.consumablesUsed)) return prev;
      return { ...prev, consumablesUsed: merged };
    });
    return undefined;
  }, [mappedConsumables]);

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
          lifecycleStage: normalizeLifecycleStage(camp.lifecycleStage, 'request'),
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
      if (field === 'hq') {
        next.hqManuallyEdited = true;
      }
      if (field === 'city' && !prev.hqManuallyEdited) {
        next.hq = value;
      }
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
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.city && !prev.hqManuallyEdited && patch.hq === undefined) {
        next.hq = patch.city;
      }
      return next;
    });
  }

  async function handleSubmitToFinance() {
    if (!id) return;
    if (!form.paymentSubmitStatus) {
      setError('Select Validation Completed, Validation Pending, or Payment On Hold');
      return;
    }
    const payeeResolved = resolveCampPayoutPayee(assignedHcwContact, hcwContacts);
    const payeeContact = payoutPayeeContact || payeeResolved.payeeContact;
    const payeeLabel = payeeResolved.payeeIsServiceProvider ? 'Service Provider' : 'HCW';
    const hcwBlockers = getHcwFinanceBlockers(payeeContact, { label: payeeLabel });
    if (hcwBlockers.length) {
      setError(`Complete ${payeeLabel} profile before Finance submit: ${hcwBlockers.join('; ')}`);
      return;
    }
    setSubmitFinanceBusy(true);
    setError('');
    try {
      const trimmed = trimFormStrings(form, formStringFields);
      const payload = {
        ...form,
        ...trimmed,
        clientId: form.clientId,
        campDate: toApiDateValue(form.campDate),
        durationHours: form.durationHours,
        patientsCount: form.patientsCount,
        editingStage: 'financial',
        lifecycleStage: maxLifecycleStage(reachedLifecycleStage, 'financial'),
        lifecycleOnly: true,
        paymentSubmitStatus: form.paymentSubmitStatus,
      };
      const res = await campApi.submitToFinance(id, payload);
      const camp = res.data?.data || res.data;
      setForm(campToForm(camp));
      setCampMeta((prev) => ({ ...prev, ...(camp || {}) }));
    } catch (err) {
      setError(err?.message || 'Failed to submit to Finance One');
    } finally {
      setSubmitFinanceBusy(false);
    }
  }

  async function handleDownloadFinanceExport() {
    if (!id) return;
    setDownloadFinanceBusy(true);
    setError('');
    try {
      await campApi.downloadFinanceExport(id, form.campId || id);
    } catch (err) {
      setError(err?.message || 'Failed to download finance Excel');
    } finally {
      setDownloadFinanceBusy(false);
    }
  }

  async function handleUploadDocuments(fileList, docType, docNote = '') {
    if (!id || !fileList?.length) return;
    setUploadBusy(true);
    setError('');
    try {
      const { data } = await campApi.uploadExecutionDocuments(id, fileList, docType, docNote);
      const camp = data?.data?.data || data?.data || data;
      const fromServer = campToForm(camp);
      setForm((prev) => ({
        ...prev,
        executionDocuments: fromServer.executionDocuments,
        inTimeSelfieUrl: fromServer.inTimeSelfieUrl,
      }));
      setCampMeta((prev) => (prev ? { ...prev, executionDocuments: fromServer.executionDocuments } : prev));
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
      stage: activeStage,
    });
    setConfirmClosureDetails(action === 'closeCamp' ? buildClosureDetails(campMeta, activeStage) : null);
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
        ? buildClosurePayload(confirmClosureDetails)
        : action === 'reject'
          ? { rejectionReason: confirmReasonDetails?.reason?.trim() || '' }
          : action === 'requestInformation'
            ? { informationRequestNote: confirmReasonDetails?.reason?.trim() || '' }
            : {};

      const handlers = {
        closeCamp: campApi.close,
        reject: campApi.reject,
        requestInformation: campApi.requestInformation,
      };
      const handler = handlers[action];
      if (!handler) throw new Error(`Unsupported camp action: ${action}`);

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
        navigate('/camp-one/manage');
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
    if (activeStage === 'financial') return;
    setHcwGapConflict(null);

    if (!isEdit && activeStage !== 'request') {
      setError('New camps can only be created at the Request stage.');
      return;
    }

    if (activeStage === 'request' || !isEdit) {
      const requestErrors = validateRequestStageForm(form, {
        canSetHistorical: canSetHistoricalCampDates(),
        existing: isEdit ? campMeta : null,
      });
      if (requestErrors.length) {
        setError(requestErrors[0]);
        return;
      }
      const duration = Number(form.durationHours);
      if (!confirmCampDurationIfNeeded(duration)) return;
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
        setError('Please select a method configured for this Client and division');
        return;
      }
    }

    if (activeStage === 'assignment' && form.hcwContactId) {
      if (!form.hcwCategory || !form.hcwName || !form.hcwContact) {
        setError('HCW Category, Name, and Contact are required when assigning');
        return;
      }
    }

    const assigningHcw = Boolean(
      form.hcwContactId
      && (activeStage === 'assignment' || form.assignmentDecision === 'assign' || form.assignmentStatus === 'Assigned'),
    );
    if (assigningHcw && form.campDate) {
      try {
        const campDate = toApiDateValue(form.campDate);
        const { data } = await campApi.list({
          hcwContactId: form.hcwContactId,
          dateFrom: campDate,
          dateTo: campDate,
          limit: 200,
        });
        const peers = Array.isArray(data?.data) ? data.data : [];
        const gapConflict = findHcwAssignmentGapConflict(
          {
            _id: id,
            campId: campMeta?.campId || form.campId,
            hcwContactId: form.hcwContactId,
            assignmentDecision: 'assign',
            status: campStatus === 'cancelled' || campStatus === 'rejected' ? campStatus : 'approved',
            campDate,
            startTime: form.startTime,
            endTime: form.endTime,
            durationHours: form.durationHours,
          },
          peers,
        );
        if (gapConflict) {
          setHcwGapConflict(gapConflict);
          setError('');
          return;
        }
        setHcwGapConflict(null);
      } catch {
        // Server still enforces the gap on save if the list pre-check fails.
      }
    }

    if (activeStage === 'execution') {
      const consumableBlockers = getExecutionConsumablesBlockers(form, mappedConsumables);
      if (consumableBlockers.length) {
        setError(consumableBlockers[0]);
        return;
      }
    }

    if (activeStage === 'execution' && normalizeExecutionStatus(form.executionStatus) === EXECUTION_STATUS.CAMP_COMPLETED) {
      const blockers = getExecutionFinanceBlockers(form, mappedConsumables);
      if (blockers.length) {
        setError(`Complete execution before Finance: ${blockers.join('; ')}.`);
        return;
      }
    }

    const trimmed = trimFormStrings(form, formStringFields);
    const contactFields = syncPrimaryContactFields(normalizeContactPersons(form));
    const executionComplete = activeStage === 'execution' && isExecutionReadyForFinance(form, mappedConsumables);
    const executionStatus = activeStage === 'execution'
      ? syncExecutionStatusForSave(form)
      : form.executionStatus;
    const requiredProductIds = mappedConsumables.map((item) => item.productId);
    const consumablesUsed = activeStage === 'execution'
      ? normalizeConsumablesUsed(form.consumablesUsed, { requiredProductIds })
      : form.consumablesUsed;
    const payload = {
      ...form,
      ...trimmed,
      ...contactFields,
      executionStatus,
      consumablesUsed,
      ...(activeStage === 'assignment' && form.hcwContactId
        ? { assignmentDecision: 'assign', assignmentRefusalReason: '' }
        : {}),
      clientId: form.clientId,
      campDate: toApiDateValue(form.campDate),
      requestDate: toApiDateValue(form.requestDate) || todayIsoDate(),
      durationHours: form.durationHours,
      expectedPatients: Number(String(form.expectedPatients ?? '').trim() || 0),
      patientsCount: form.patientsCount,
      editingStage: isEdit ? activeStage : 'request',
      lifecycleStage: isEdit
        ? executionComplete
          ? maxLifecycleStage(reachedLifecycleStage, 'financial')
          : maxLifecycleStage(reachedLifecycleStage, activeStage)
        : 'request',
      lifecycleOnly: isEdit && activeStage !== 'request',
    };
    delete payload.hqManuallyEdited;
    delete payload.addressPlacesAvailable;

    setLoading(true);
    setError('');
    setHcwGapConflict(null);
    try {
      if (isEdit) {
        const res = await campApi.update(id, payload);
        if (executionComplete) {
          const camp = res.data?.data || res.data;
          if (camp) {
            setForm(campToForm(camp));
            setCampMeta((prev) => ({ ...prev, ...camp }));
            setActiveStage('financial');
            setError('');
            setHcwGapConflict(null);
            return;
          }
        }
      } else {
        await campApi.create(payload);
      }
      navigate('/camp-one/manage');
    } catch (err) {
      const code = err?.code || err?.error?.code || '';
      const message = err?.message || 'Failed to save camp';
      if (code === 'HCW_ASSIGNMENT_GAP' || /1 hour 30 minutes|HCW already has camp|schedule gap/i.test(message)) {
        setHcwGapConflict({
          title: 'HCW schedule conflict',
          summary: message,
          message,
        });
        setError('');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const campNameOptions = useMemo(
    () => resolveCampNameOptions(divisionPrograms, form.campaignType, form.campaignName),
    [divisionPrograms, form.campaignType, form.campaignName],
  );

  const clientMasterProfessions = useMemo(
    () => resolveClientMasterHealthcareWorkers(clientMasterRecords, {
      campaignType: form.campaignType,
      campaignName: form.campaignName,
    }),
    [clientMasterRecords, form.campaignType, form.campaignName],
  );
  const clientMasterProfession = clientMasterProfessions[0] || '';
  const clientMasterHcwGap = useMemo(() => {
    if (clientMasterLoadFailed) return 'load_failed';
    return diagnoseClientMasterHcwGap(clientMasterRecords, {
      campaignType: form.campaignType,
      campaignName: form.campaignName,
    });
  }, [clientMasterLoadFailed, clientMasterRecords, form.campaignType, form.campaignName]);

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
        <button type="button" className="btn secondary" onClick={() => navigate('/camp-one/manage')}>
          Back to camps
        </button>
      </div>
    );
  }

  if (!isEdit && workingStage !== 'request') {
    return (
      <div className="empty-state">
        <p>New camps can only be added at the Request stage. Switch to Request to create a camp.</p>
        <button type="button" className="btn secondary" onClick={() => navigate('/camp-one/manage')}>
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
  const financeSubmitted = Boolean(form.submittedToFinanceAt);
  const payeeResolved = resolveCampPayoutPayee(assignedHcwContact, hcwContacts);
  const payeeContact = payoutPayeeContact || payeeResolved.payeeContact;
  const payeeLabel = payeeResolved.payeeIsServiceProvider ? 'Service Provider' : 'HCW';
  const hcwFinanceBlockers = activeStage === 'financial' && !financeSubmitted
    ? getHcwFinanceBlockers(payeeContact, { label: payeeLabel })
    : [];
  const showFinanceSubmit = isEdit
    && activeStage === 'financial'
    && !financeSubmitted
    && canEditLifecycleStage(campStatus, 'financial', reachedLifecycleStage)
    && !readOnly;
  const canSubmitFinance = showFinanceSubmit
    && Boolean(form.paymentSubmitStatus)
    && isHcwReadyForFinance(payeeContact, { label: payeeLabel })
    && !assignedHcwLoading
    && !payoutPayeeLoading
    && !submitFinanceBusy;
  const canSubmit = campStatus !== 'cancelled'
    && campStatus !== 'rejected'
    && activeStage !== 'financial'
    && canEditLifecycleStage(campStatus, activeStage, reachedLifecycleStage)
    && (!hasNoDivisions || activeStage !== 'request')
    && (!hasNoMethods || activeStage !== 'request')
    && (activeStage !== 'assignment' || ['approved', 'executed'].includes(campStatus));

  return (
    <form ref={formRef} className="form-card camp-lifecycle-page" onSubmit={handleSubmit} autoComplete="off" data-form-type="other">
      <AutofillDecoyFields />
      <div className="camp-form-header-row">
        <FormPageHeader title={isEdit ? 'Edit Camp' : 'Create Camp'} backTo="/camp-one/manage" />
        {isEdit && campMeta && (
          <div className="camp-form-header-actions">
            <CampRowIconButton
              icon={X}
              label="Close"
              variant="neutral"
              onClick={() => navigate('/camp-one/manage')}
            />
            <CampRowInfoMenu
              camp={campMeta}
              hasPermission={hasPermission}
              onAction={requestCampAction}
            />
          </div>
        )}
      </div>

      {campMeta && (
        <div className="meta-text camp-form-meta">
          <div><strong>Camp ID:</strong> {campMeta.campId}</div>
          <div><strong>Status:</strong> {campMeta.status.replaceAll('_', ' ')}</div>
        </div>
      )}

      <PageAlerts
        className="camp-form-alerts"
        items={[
          campMeta?.requestReviewStatus === 'information_requested' && {
            variant: 'warning',
            message: `Reviewer requested more information${campMeta.informationRequestNote ? `: ${campMeta.informationRequestNote}` : '.'} Update the request and save to resubmit for review.`,
          },
          visibleApprovalBlockers.length > 0 && {
            variant: 'error',
            message: `Cannot approve until resolved: ${visibleApprovalBlockers.join(' ')}`,
          },
          hasNoDivisions && activeStage === 'request' && { variant: 'error', message: NO_DIVISION_MESSAGE },
          hasNoMethods && activeStage === 'request' && { variant: 'error', message: NO_METHOD_MESSAGE },
          hcwGapConflict && {
            key: 'hcw-gap-conflict',
            variant: 'error',
            className: 'hcw-gap-alert-banner',
            message: <HcwAssignmentGapAlert conflict={hcwGapConflict} />,
          },
          error && !hcwGapConflict && { variant: 'error', message: error },
        ].filter(Boolean)}
      />

      {isEdit && campMeta && (campMeta.source === 'email' || campMeta.source === 'whatsapp') && (
        <div className="camp-form-source-section">
          <button type="button" className="btn secondary btn-compact" onClick={() => setShowSourcePreview((o) => !o)}>
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
        onStageChange={(stage) => {
          if (!isEdit) return;
          setActiveStage(normalizeLifecycleStage(stage, activeStage));
        }}
        campStatus={campStatus}
        clients={clients}
        divisionOptions={divisionOptions}
        campNameOptions={campNameOptions}
        programsLoading={programsLoading}
        stageReadOnly={stageReadOnly}
        campId={isEdit ? id : null}
        onUploadDocuments={handleUploadDocuments}
        uploadBusy={uploadBusy}
        onDownloadFinanceExport={isEdit && form.submittedToFinanceAt ? handleDownloadFinanceExport : null}
        downloadFinanceBusy={downloadFinanceBusy}
        hcwContacts={hcwContacts}
        contactsLoading={contactsLoading}
        clientMasterProfessions={clientMasterProfessions}
        clientMasterProfession={clientMasterProfession}
        clientMasterLoading={clientMasterLoading}
        clientMasterHcwGap={clientMasterHcwGap}
        onValidationError={setError}
        reachedLifecycleStage={reachedLifecycleStage}
        assignedHcwContact={assignedHcwContact}
        assignedHcwLoading={assignedHcwLoading}
        hcwFinanceBlockers={hcwFinanceBlockers}
        mappedConsumables={mappedConsumables}
        canSetHistoricalCampDates={canSetHistoricalCampDates()}
      />

      <div className="form-actions">
        {showFinanceSubmit ? (
          <button
            className="btn"
            type="button"
            disabled={!canSubmitFinance}
            title={!canSubmitFinance && hcwFinanceBlockers.length
              ? hcwFinanceBlockers.join(' ')
              : (!form.paymentSubmitStatus ? 'Select a payment check status' : undefined)}
            onClick={handleSubmitToFinance}
          >
            {submitFinanceBusy ? 'Submitting…' : 'Submit to Finance One'}
          </button>
        ) : null}
        {canSubmit && (
          <button className="btn" type="submit" disabled={loading || uploadBusy}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Camp'}
          </button>
        )}
        <button type="button" className="btn secondary" onClick={() => navigate('/camp-one/manage')}>
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
