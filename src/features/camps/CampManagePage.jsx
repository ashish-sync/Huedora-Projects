import { useCallback, useEffect, useRef, useState } from 'react';
import { PageAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CampsFilters,
  REQUEST_STATUS_OPTIONS,
  ASSIGNMENT_STATUS_OPTIONS,
} from './components/CampsFilters';

const REQUEST_STATUS_LABELS = Object.fromEntries(
  REQUEST_STATUS_OPTIONS.map((option) => [option.value, option.label])
);
const ASSIGNMENT_STATUS_LABELS = Object.fromEntries(
  ASSIGNMENT_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

/** Map legacy Request Stage status query values to review-status filters. */
function normalizeRequestStatusFilter(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === 'rejected') return 'request_rejected';
  if (raw === 'pending_review') return 'review_pending';
  if (raw === 'approved' || raw === 'cancelled') return '';
  if (REQUEST_STATUS_LABELS[raw]) return raw;
  return '';
}
import { CampTimeFrame } from './components/CampTimeFrame';
import { CampRowInfoMenu } from './components/CampRowInfoMenu';
import { CampCancelRefuseButton } from './components/CampCancelRefuseButton';
import { CampRequestRowActions } from './components/CampRequestRowActions';
import { CampAssignmentRowActions } from './components/CampAssignmentRowActions';
import { CampExecutionRowActions } from './components/CampExecutionRowActions';
import { CampFinancialRowActions } from './components/CampFinancialRowActions';
import { CampAdminDeleteButton } from './components/CampAdminDeleteButton';
import { CampActionConfirmModal } from './components/CampActionConfirmModal';
import { api } from '../../shared/api.js';
import { Pagination } from './components/Pagination';
import { DEFAULT_PAGE_SIZE } from './constants/pagination';
import {
  getCampRowClassName,
  StatusBadge,
  AssignmentStatusBadge,
  ExecutionStatusBadge,
  FinanceSettlementStatusBadge,
  RequestReviewStatusBadge,
} from './components/DashboardWidgets';
import { useAuth } from './useCampOpsAuth.js';
import { campApi } from './campOpsApi.js';
import { trimString } from './utils/trimInput';
import { validateBulkCampAction } from './utils/campBulkActions';
import { canMarkCampExecuted, getExecutionBlockers } from './utils/campExecutionActions';
import { useAutoDismiss } from './hooks/useAutoDismiss';

import { formatDateDDMMYYYY, formatDateRangeLabel } from './utils/dateFormat';
import {
  clearStoredManageFilters,
  readStoredManageDateFilter,
  readStoredManageFilters,
  writeStoredManageFilters,
} from './utils/campManageDateFilterStorage.js';
import { EmptyState } from '../../components/ui/PageShell.jsx';
import { useCampWorkingStage } from './CampWorkingStageContext.jsx';
import { buildClosureDetails, buildClosurePayload } from './constants/campClosure';

function buildReasonDetails() {
  return { reason: '' };
}

function buildCancelDetails() {
  return { cancelledBy: 'brand', remarks: '' };
}

function cellText(value) {
  const text = String(value || '').trim();
  return text || <span className="camps-cell-empty">—</span>;
}

export default function CampsPage() {
  const {
    hasPermission,
    isSuperAdmin,
    canApproveCamps,
    canRejectCamps,
    canEditCampRecord,
  } = useAuth();
  const { workingStage, workingStageMeta, setWorkingStage } = useCampWorkingStage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [camps, setCamps] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [statusByStage, setStatusByStage] = useState(() => {
    const stored = readStoredManageFilters();
    const stageHint = searchParams.get('stage') || searchParams.get('lifecycleStage') || 'request';
    const rawStatus = searchParams.get('status') || '';
    const next = { ...stored.statusByStage };
    if (rawStatus) {
      next[stageHint] =
        stageHint === 'request' ? normalizeRequestStatusFilter(rawStatus) : rawStatus;
    }
    return next;
  });
  const status = statusByStage[workingStage] || '';
  const [dateFrom, setDateFrom] = useState(() => (
    searchParams.get('dateFrom') || readStoredManageFilters().dateFrom || ''
  ));
  const [dateTo, setDateTo] = useState(() => (
    searchParams.get('dateTo') || readStoredManageFilters().dateTo || ''
  ));
  const [clientFilter, setClientFilter] = useState(() => (
    searchParams.get('client') || readStoredManageFilters().client || ''
  ));
  const [campaignFilter, setCampaignFilter] = useState(() => (
    searchParams.get('campaign') || readStoredManageFilters().campaign || ''
  ));
  const [campTypeFilter, setCampTypeFilter] = useState(() => (
    searchParams.get('campaignType') || readStoredManageFilters().campaignType || ''
  ));
  const [search, setSearch] = useState(() => (
    searchParams.get('findCampId')
      || searchParams.get('q')
      || readStoredManageFilters().search
      || ''
  ));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [confirmCancelDetails, setConfirmCancelDetails] = useState(null);
  const [confirmClosureDetails, setConfirmClosureDetails] = useState(null);
  const [confirmReasonDetails, setConfirmReasonDetails] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const dismissError = useCallback(() => setError(''), []);
  const dismissBulkMessage = useCallback(() => setBulkMessage(''), []);

  useAutoDismiss(error, dismissError);
  useAutoDismiss(bulkMessage, dismissBulkMessage);

  const findCampFromUrlRef = useRef('');
  const dateFilterReadyRef = useRef(false);

  useEffect(() => {
    // Deep-link from "camp created" / find-by-id only — never treat generic `q` search as this.
    const findCampId = searchParams.get('findCampId') || '';
    if (!findCampId) return;
    findCampFromUrlRef.current = findCampId;
    setWorkingStage('request');
    setStatusByStage((prev) => ({ ...prev, request: '' }));
    setSearch(findCampId);
    setPage(1);
    loadCamps(1, pageSize, findCampId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore filters from session when URL omits them (e.g. return from Edit Camp).
  // Once set, filters stay until the user clears them manually.
  useEffect(() => {
    if (dateFilterReadyRef.current) return;
    dateFilterReadyRef.current = true;

    // Deep-link from camp-created banner owns this mount — do not resurrect
    // stored filters over findCampId (would fight stage/search and double-fetch).
    if (searchParams.get('findCampId')) return;

    const stored = readStoredManageFilters();
    const urlFrom = searchParams.get('dateFrom') || '';
    const urlTo = searchParams.get('dateTo') || '';
    const urlQ = searchParams.get('q') || '';
    const urlStatus = searchParams.get('status') || '';
    const urlClient = searchParams.get('client') || '';
    const urlCampaign = searchParams.get('campaign') || '';
    const urlCampType = searchParams.get('campaignType') || '';

    const nextDateFrom = urlFrom || stored.dateFrom;
    const nextDateTo = urlTo || stored.dateTo;
    const nextSearch = urlQ || stored.search;
    const nextClient = urlClient || stored.client;
    const nextCampaign = urlCampaign || stored.campaign;
    const nextCampType = urlCampType || stored.campaignType;

    if (!urlFrom && !urlTo && (stored.dateFrom || stored.dateTo)) {
      setDateFrom(stored.dateFrom);
      setDateTo(stored.dateTo);
    }
    if (!urlQ && stored.search) setSearch(stored.search);
    if (!urlClient && stored.client) setClientFilter(stored.client);
    if (!urlCampaign && stored.campaign) setCampaignFilter(stored.campaign);
    if (!urlCampType && stored.campaignType) setCampTypeFilter(stored.campaignType);
    if (!urlStatus) {
      setStatusByStage((prev) => ({
        ...stored.statusByStage,
        ...prev,
      }));
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (workingStage) next.set('stage', workingStage);
      if (nextDateFrom) next.set('dateFrom', nextDateFrom);
      else next.delete('dateFrom');
      if (nextDateTo) next.set('dateTo', nextDateTo);
      else next.delete('dateTo');
      if (nextSearch) next.set('q', nextSearch);
      else next.delete('q');
      if (nextClient) next.set('client', nextClient);
      else next.delete('client');
      if (nextCampaign) next.set('campaign', nextCampaign);
      else next.delete('campaign');
      if (nextCampType) next.set('campaignType', nextCampType);
      else next.delete('campaignType');
      const stageStatus = urlStatus
        || stored.statusByStage[workingStage]
        || '';
      if (stageStatus) next.set('status', stageStatus);
      else next.delete('status');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dateFilterReadyRef.current) return;
    writeStoredManageFilters({
      search,
      statusByStage,
      dateFrom,
      dateTo,
      client: clientFilter,
      campaign: campaignFilter,
      campaignType: campTypeFilter,
    });
  }, [search, statusByStage, dateFrom, dateTo, clientFilter, campaignFilter, campTypeFilter]);

  useEffect(() => {
    const refresh = () => {
      if (typeof window === 'undefined') return;
      if (!window.sessionStorage.getItem('campOps:refreshList')) return;
      window.sessionStorage.removeItem('campOps:refreshList');
      loadCamps(page, pageSize);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCampActionConfirm(action, camp) {
    setConfirmRequest({
      mode: 'single',
      action,
      camp,
      stage: workingStage,
    });
    setConfirmCancelDetails(action === 'cancel' ? buildCancelDetails() : null);
    setConfirmClosureDetails(action === 'closeCamp' ? buildClosureDetails(camp, workingStage) : null);
    setConfirmReasonDetails(['reject', 'requestInformation'].includes(action) ? buildReasonDetails() : null);
    setError('');
  }

  function getBulkAuth() {
    return {
      hasPermission,
      canApproveCamps,
      canRejectCamps,
      isSuperAdmin,
    };
  }

  function getSelectedCamps() {
    return camps.filter((camp) => selectedIds.includes(camp._id));
  }

  function openBulkActionConfirm(action) {
    const validation = validateBulkCampAction(action, getSelectedCamps(), getBulkAuth());
    if (!validation.ok) {
      setBulkMessage('');
      setError(validation.message);
      return;
    }

    setConfirmRequest({
      mode: 'bulk',
      action,
      count: validation.count,
      ids: validation.ids,
    });
    setConfirmCancelDetails(null);
    setConfirmClosureDetails(null);
    setConfirmReasonDetails(action === 'reject' ? buildReasonDetails() : null);
    setError('');
  }

  function closeCampActionConfirm() {
    if (confirmLoading) return;
    setConfirmRequest(null);
    setConfirmCancelDetails(null);
    setConfirmClosureDetails(null);
    setConfirmReasonDetails(null);
  }

  async function executeCampActionConfirm() {
    if (!confirmRequest) return;

    setConfirmLoading(true);
    setError('');
    setBulkMessage('');

    try {
      if (confirmRequest.mode === 'bulk') {
        const selectedCamps = camps.filter((camp) => (
          (confirmRequest.ids || selectedIds).includes(camp._id)
        ));
        const validation = validateBulkCampAction(confirmRequest.action, selectedCamps, getBulkAuth());
        if (!validation.ok) {
          setError(validation.message);
          return;
        }

        if (confirmRequest.action === 'reject') {
          const rejectionReason = confirmReasonDetails?.reason?.trim() || '';
          if (!rejectionReason) {
            setError('Refusal reason is required');
            return;
          }
        }

        const { data } = await campApi.bulkAction({
          ids: validation.ids,
          action: confirmRequest.action,
          ...(confirmRequest.action === 'reject'
            ? { rejectionReason: confirmReasonDetails?.reason?.trim() || '' }
            : {}),
        });
        setBulkMessage(`${data.summary.success} succeeded, ${data.summary.failed} failed`);
        if (data.results.failed.length) {
          setError(data.results.failed.map((item) => `${item.campId}: ${item.reason}`).join(' | '));
        }
      } else {
        const { action, camp } = confirmRequest;
        const payload = action === 'cancel'
          ? {
            cancelledBy: confirmCancelDetails.cancelledBy,
            remarks: confirmCancelDetails.remarks.trim(),
          }
          : action === 'closeCamp'
            ? buildClosurePayload(
              confirmClosureDetails,
              camp,
              confirmRequest.stage || workingStage,
            )
            : action === 'reject'
            ? { rejectionReason: confirmReasonDetails?.reason?.trim() || '' }
            : action === 'requestInformation'
              ? { informationRequestNote: confirmReasonDetails?.reason?.trim() || '' }
              : {};
        await runCampAction(action, camp, payload);
      }

      const executedAction = confirmRequest.action === 'execute';
      const executedBulk = confirmRequest.mode === 'bulk';
      setConfirmRequest(null);
      setConfirmCancelDetails(null);
      setConfirmClosureDetails(null);
      setConfirmReasonDetails(null);
      if (executedAction) {
        setBulkMessage(
          executedBulk
            ? 'Camp execution action completed for the selected camps.'
            : 'Camp execution action completed.'
        );
        await loadCamps();
      } else {
        await loadCamps();
      }
    } catch (err) {
      setError(err?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
    }
  }

  function requestCampAction(campId, action) {
    const camp = camps.find((item) => String(item._id) === String(campId));
    if (!camp) {
      setError('Camp not found. Refresh the list and try again.');
      return;
    }
    openCampActionConfirm(action, camp);
  }

  async function runCampAction(action, camp, payload = {}) {
    const handlers = {
      approve: campApi.approve,
      reject: campApi.reject,
      requestInformation: campApi.requestInformation,
      cancel: campApi.cancel,
      closeCamp: campApi.close,
      execute: campApi.execute,
      submitReview: campApi.submitReview,
      delete: campApi.delete,
    };

    const handler = handlers[action];
    if (!handler) {
      throw new Error(`Unsupported camp action: ${action}`);
    }

    await handler(camp._id, payload);
  }

  async function loadCamps(nextPage = page, nextLimit = pageSize, searchOverride) {
    setLoading(true);
    const trimmedSearch = trimString(searchOverride ?? search);
    setSearch(trimmedSearch);
    try {
      const params = { search: trimmedSearch, page: nextPage, limit: nextLimit };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (clientFilter) params.client = clientFilter;
      if (campaignFilter) params.campaign = campaignFilter;
      if (campTypeFilter) params.campaignType = campTypeFilter;
      if (
        workingStage === 'request' ||
        workingStage === 'assignment' ||
        workingStage === 'execution' ||
        workingStage === 'financial'
      ) {
        params.lifecycleStage = workingStage;
      } else if (workingStage) {
        params.lifecycleStage = workingStage;
      }
      if (status) {
        if (workingStage === 'assignment') {
          params.assignmentFilter = status;
        } else if (workingStage === 'execution') {
          params.executionFilter = status;
        } else if (workingStage === 'financial') {
          params.financialFilter = status;
        } else if (workingStage === 'request') {
          params.requestReviewStatus = status;
        } else {
          params.status = status;
        }
      }
      const { data } = await campApi.list(params);
      setCamps(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || null);
      setPage(nextPage);
      setPageSize(nextLimit);
      setSelectedIds([]);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load camps');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulk(action) {
    openBulkActionConfirm(action);
  }

  // Keep a live ref so URL→state sync can read the current stage without
  // depending on `workingStage` (that dependency re-applied stale ?stage= and
  // undid every Working view change after filter persistence always wrote stage).
  const workingStageRef = useRef(workingStage);
  workingStageRef.current = workingStage;

  useEffect(() => {
    const stageFromUrl = searchParams.get('stage') || searchParams.get('lifecycleStage') || '';
    if (stageFromUrl && stageFromUrl !== workingStageRef.current) {
      setWorkingStage(stageFromUrl);
    }
    const resolvedStage = stageFromUrl || workingStageRef.current;
    const rawStatus = searchParams.get('status') || '';
    if (rawStatus) {
      const normalized =
        resolvedStage === 'request' ? normalizeRequestStatusFilter(rawStatus) : rawStatus;
      setStatusByStage((prev) => (
        prev[resolvedStage] === normalized
          ? prev
          : { ...prev, [resolvedStage]: normalized }
      ));
    }
    const urlFrom = searchParams.get('dateFrom') || '';
    const urlTo = searchParams.get('dateTo') || '';
    if (urlFrom || urlTo) {
      setDateFrom(urlFrom);
      setDateTo(urlTo);
    } else {
      // Empty URL: clear only when session has no dates (user cleared, or never set).
      const stored = readStoredManageDateFilter();
      if (!stored.dateFrom && !stored.dateTo) {
        setDateFrom('');
        setDateTo('');
      }
    }
    if (searchParams.has('client')) setClientFilter(searchParams.get('client') || '');
    if (searchParams.has('campaign')) setCampaignFilter(searchParams.get('campaign') || '');
    if (searchParams.has('campaignType')) setCampTypeFilter(searchParams.get('campaignType') || '');
    if (searchParams.has('q') || searchParams.has('findCampId')) {
      setSearch(searchParams.get('findCampId') || searchParams.get('q') || '');
    }
  }, [searchParams, setWorkingStage]);

  const previousWorkingStageRef = useRef(workingStage);
  const statusByStageRef = useRef(statusByStage);
  statusByStageRef.current = statusByStage;
  useEffect(() => {
    if (previousWorkingStageRef.current === workingStage) return;
    previousWorkingStageRef.current = workingStage;
    // Keep all filters (including typed search). Only swap the URL status to
    // this stage's remembered value — never wipe filters on stage change.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('stage', workingStage);
      next.delete('assignmentFilter');
      next.delete('requestReviewStatus');
      next.delete('executionFilter');
      next.delete('financialFilter');
      next.delete('overdue');
      next.delete('reactionRequired');
      next.delete('offHours');
      next.delete('weekendAttention');
      const stageStatus = statusByStageRef.current[workingStage] || '';
      if (stageStatus) next.set('status', stageStatus);
      else next.delete('status');
      return next;
    });
  }, [workingStage, setSearchParams]);

  useEffect(() => {
    if (findCampFromUrlRef.current) {
      findCampFromUrlRef.current = '';
      return;
    }
    setPage(1);
    loadCamps(1, pageSize);
  }, [status, dateFrom, dateTo, clientFilter, campaignFilter, campTypeFilter, workingStage]);

  function handlePageChange(nextPage) {
    loadCamps(nextPage, pageSize);
  }

  function handlePageSizeChange(nextPageSize) {
    setPage(1);
    loadCamps(1, nextPageSize);
  }

  function buildFilterParams(overrides = {}) {
    const params = new URLSearchParams();
    const nextStatus = overrides.status ?? status;
    const nextDateFrom = overrides.dateFrom ?? dateFrom;
    const nextDateTo = overrides.dateTo ?? dateTo;
    const nextClient = overrides.client ?? clientFilter;
    const nextCampaign = overrides.campaign ?? campaignFilter;
    const nextCampType = overrides.campaignType ?? campTypeFilter;
    const nextSearch = overrides.search ?? search;

    if (workingStage) params.set('stage', workingStage);
    if (nextStatus) params.set('status', nextStatus);
    if (nextDateFrom) params.set('dateFrom', nextDateFrom);
    if (nextDateTo) params.set('dateTo', nextDateTo);
    if (nextClient) params.set('client', nextClient);
    if (nextCampaign) params.set('campaign', nextCampaign);
    if (nextCampType) params.set('campaignType', nextCampType);
    if (nextSearch) params.set('q', nextSearch);
    return params;
  }

  function applyQuickRange(range) {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    updateFilters({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
  }

  function updateFilters(overrides = {}) {
    setSearchParams(buildFilterParams(overrides));
  }

  function handleStatusChange(value) {
    const nextStatus =
      workingStage === 'request' ? normalizeRequestStatusFilter(value) : value;
    setStatusByStage((prev) => ({ ...prev, [workingStage]: nextStatus }));
    updateFilters({ status: nextStatus });
  }

  function clearFilters() {
    setStatusByStage({
      request: '',
      assignment: '',
      execution: '',
      financial: '',
    });
    setDateFrom('');
    setDateTo('');
    setClientFilter('');
    setCampaignFilter('');
    setCampTypeFilter('');
    setSearch('');
    clearStoredManageFilters();
    setSearchParams(workingStage ? { stage: workingStage } : {});
  }

  function handleFilterChange(value) {
    handleStatusChange(value);
  }

  function handleSearch() {
    setPage(1);
    updateFilters({ search: trimString(search) });
    loadCamps(1, pageSize);
  }

  const filterValue = status;

  const activeChips = [];
  if (search) {
    activeChips.push({
      key: 'search',
      label: `Search: ${search}`,
      onRemove: () => {
        setSearch('');
        updateFilters({ search: '' });
        loadCamps(1, pageSize, '');
      },
    });
  }
  if (status) {
    activeChips.push({
      key: 'status',
      label:
        (workingStage === 'request' && REQUEST_STATUS_LABELS[status])
        || (workingStage === 'assignment' && ASSIGNMENT_STATUS_LABELS[status])
        || status.replaceAll('_', ' '),
      onRemove: () => handleFilterChange(''),
    });
  }
  if (dateFrom || dateTo) {
    activeChips.push({
      key: 'date',
      label: `Date: ${formatDateRangeLabel(dateFrom, dateTo)}`,
      onRemove: () => applyQuickRange({ dateFrom: '', dateTo: '' }),
    });
  }
  if (clientFilter) {
    activeChips.push({
      key: 'client',
      label: 'Brand filter',
      onRemove: () => {
        setClientFilter('');
        updateFilters({ client: '' });
      },
    });
  }
  if (campaignFilter) {
    activeChips.push({
      key: 'campaign',
      label: 'Campaign / division',
      onRemove: () => {
        setCampaignFilter('');
        updateFilters({ campaign: '' });
      },
    });
  }
  if (campTypeFilter) {
    activeChips.push({
      key: 'campType',
      label: `Camp type: ${campTypeFilter}`,
      onRemove: () => {
        setCampTypeFilter('');
        updateFilters({ campaignType: '' });
      },
    });
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  }

  function toggleSelectAll() {
    if (selectedIds.length === camps.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(camps.map((camp) => camp._id));
    }
  }

  const selectedCamps = camps.filter((camp) => selectedIds.includes(camp._id));
  const bulkAuth = getBulkAuth();
  const bulkApproveValidation = validateBulkCampAction('approve', selectedCamps, bulkAuth);
  const bulkRejectValidation = validateBulkCampAction('reject', selectedCamps, bulkAuth);
  const canAdminDeleteCamps = isSuperAdmin();
  const bulkDeleteValidation = validateBulkCampAction('delete', selectedCamps, bulkAuth);

  const isRequestStage = workingStage === 'request';
  const isAssignmentStage = workingStage === 'assignment';
  const isExecutionStage = workingStage === 'execution';
  const isFinancialStage = workingStage === 'financial';

  const showBulkApproveRefuse = isRequestStage;
  const showBulkExecute = isExecutionStage;
  const showRowSelection = canAdminDeleteCamps
    || (showBulkApproveRefuse && (canApproveCamps() || canRejectCamps()))
    || (showBulkExecute && hasPermission('camps:execute'));
  const showBulkBar = selectedIds.length > 0 && showRowSelection;

  const bulkExecuteValidation = validateBulkCampAction('execute', selectedCamps, bulkAuth);

  function renderCampActions(camp) {
    const cancelRefuse = (
      <CampCancelRefuseButton
        camp={camp}
        hasPermission={hasPermission}
        canRejectCamps={canRejectCamps()}
        onAction={requestCampAction}
      />
    );

    if (isRequestStage) {
      return (
        <CampRequestRowActions
          camp={camp}
          canEdit={canEditCampRecord(camp)}
          canApprove={canApproveCamps()}
          canRejectCamps={canRejectCamps()}
          hasPermission={hasPermission}
          canDelete={canAdminDeleteCamps}
          onApprove={() => openCampActionConfirm('approve', camp)}
          onAction={requestCampAction}
        />
      );
    }

    if (isAssignmentStage) {
      return (
        <CampAssignmentRowActions
          camp={camp}
          canEdit={canEditCampRecord(camp)}
          canRejectCamps={canRejectCamps()}
          hasPermission={hasPermission}
          canDelete={canAdminDeleteCamps}
          onAction={requestCampAction}
        />
      );
    }

    if (isExecutionStage) {
      return (
        <CampExecutionRowActions
          camp={camp}
          canEdit={canEditCampRecord(camp)}
          canRejectCamps={canRejectCamps()}
          hasPermission={hasPermission}
          canDelete={canAdminDeleteCamps}
          onAction={requestCampAction}
        />
      );
    }

    if (isFinancialStage) {
      return (
        <CampFinancialRowActions
          camp={camp}
          canEdit={canEditCampRecord(camp)}
          canDelete={canAdminDeleteCamps}
          onAction={requestCampAction}
        />
      );
    }

    return (
      <div className="actions camp-row-actions">
        {canEditCampRecord(camp) && (
          <Link to={`/camp-one/manage/${camp._id}/edit`} className="btn secondary btn-compact">
            Edit
          </Link>
        )}
        {camp.status === 'pending_review' && canApproveCamps() && (
          <button
            className="btn btn-compact"
            disabled={camp.canApprove === false}
            title={camp.canApprove === false ? (camp.approvalBlockers || []).join(' ') : undefined}
            onClick={() => openCampActionConfirm('approve', camp)}
          >
            Approve
          </button>
        )}
        {camp.status === 'approved' && hasPermission('camps:execute') && (
          <button
            className="btn btn-compact"
            disabled={!canMarkCampExecuted(camp)}
            title={canMarkCampExecuted(camp) ? undefined : getExecutionBlockers(camp).join(' · ')}
            onClick={() => openCampActionConfirm('execute', camp)}
          >
            Mark Executed
          </button>
        )}
        {cancelRefuse}
        <CampAdminDeleteButton
          canDelete={canAdminDeleteCamps}
          campId={camp._id}
          onDelete={requestCampAction}
        />
        <CampRowInfoMenu
          camp={camp}
          hasPermission={hasPermission}
          onAction={requestCampAction}
        />
      </div>
    );
  }

  function renderCampStatus(camp) {
    if (isAssignmentStage) {
      return <AssignmentStatusBadge camp={camp} />;
    }
    if (isExecutionStage) {
      return <ExecutionStatusBadge camp={camp} />;
    }
    if (isFinancialStage) {
      return <FinanceSettlementStatusBadge camp={camp} />;
    }
    if (isRequestStage) {
      return <RequestReviewStatusBadge camp={camp} />;
    }
    return <StatusBadge status={camp.status} />;
  }

  return (
    <>
      {(bulkMessage || error) && (
        <PageAlerts
          className="page-alerts--compact"
          items={[
            bulkMessage && { variant: 'success', message: bulkMessage },
            error && { variant: 'error', message: error },
          ].filter(Boolean)}
        />
      )}

      <div className="card card--flush table-wrap camps-manage-card">
        <CampsFilters
          search={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearch}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(value) => updateFilters({ dateFrom: value, dateTo })}
          onDateToChange={(value) => updateFilters({ dateFrom, dateTo: value })}
          onQuickSelect={applyQuickRange}
          onClearDates={() => applyQuickRange({ dateFrom: '', dateTo: '' })}
          filterValue={filterValue}
          onFilterChange={handleFilterChange}
          showStatusFilter
          workingStage={workingStage}
          activeChips={activeChips}
          onClearAll={clearFilters}
        />

        {showBulkBar && (
          <div className="bulk-bar camps-manage-bulk-bar">
          <span>{selectedIds.length} selected</span>
          {canApproveCamps() && showBulkApproveRefuse && (
            <button
              className="btn btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkApproveValidation.ok}
              title={!bulkApproveValidation.ok ? bulkApproveValidation.message : undefined}
              onClick={() => handleBulk('approve')}
            >
              Approve Selected
            </button>
          )}
          {canRejectCamps() && showBulkApproveRefuse && (
            <button
              className="btn danger btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkRejectValidation.ok}
              title={!bulkRejectValidation.ok ? bulkRejectValidation.message : undefined}
              onClick={() => handleBulk('reject')}
            >
              Refuse Selected
            </button>
          )}
          {hasPermission('camps:execute') && showBulkExecute && (
            <button
              className="btn btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkExecuteValidation.ok}
              title={!bulkExecuteValidation.ok ? bulkExecuteValidation.message : undefined}
              onClick={() => handleBulk('execute')}
            >
              Mark Executed
            </button>
          )}
          {canAdminDeleteCamps && (
            <button
              className="btn danger btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkDeleteValidation.ok}
              title={!bulkDeleteValidation.ok ? bulkDeleteValidation.message : undefined}
              onClick={() => handleBulk('delete')}
            >
              Delete Selected
            </button>
          )}
          </div>
        )}

        {!workingStage ? (
          <EmptyState
            title="Select your working stage"
            description="Choose a lifecycle view from the dropdown in the header."
          />
        ) : loading ? (
          <EmptyState title="Loading…" description="Fetching camps." />
        ) : camps.length === 0 ? (
          <EmptyState
            title={`No camps in ${workingStageMeta?.label || 'this stage'}`}
            description={
              isRequestStage
                ? 'Create a camp or import from Excel to see records here.'
                : 'Camps appear here as they progress from Request. Switch to Request to add a new camp.'
            }
            action={
              isRequestStage && (hasPermission('camps:create') || hasPermission('camps:update')) ? (
                <Link to="/camp-one/manage/new" className="btn">New Camp</Link>
              ) : null
            }
          />
        ) : (
          <div className="table-scroll">
            <table className={isRequestStage ? 'camps-table camps-table--request' : 'camps-table'}>
              <thead>
                <tr>
                  {showRowSelection && (
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === camps.length && camps.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="col-client">Client Name</th>
                  <th className="col-division">Division / Therapy</th>
                  <th className="col-method">Method</th>
                  {isRequestStage ? (
                    <>
                      <th className="col-date">Date</th>
                      <th className="col-timeframe">Time Frame</th>
                      <th className="col-state">State</th>
                      <th className="col-city">City</th>
                    </>
                  ) : (
                    <>
                      <th className="col-timeframe">Time Frame</th>
                      <th>Doctor</th>
                      <th className="col-city">City</th>
                      <th className="col-date">Date</th>
                    </>
                  )}
                  <th className="col-status">Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {camps.map((camp) => (
                  <tr key={camp._id} className={getCampRowClassName(camp)}>
                    {showRowSelection && (
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(camp._id)}
                          onChange={() => toggleSelect(camp._id)}
                        />
                      </td>
                    )}
                    <td className="col-client">
                      <span className="camps-cell-client" title={camp.clientName || undefined}>
                        {cellText(camp.clientName)}
                      </span>
                    </td>
                    <td className="col-division">{cellText(camp.campaignType)}</td>
                    <td className="col-method">{cellText(camp.campaignName)}</td>
                    {isRequestStage ? (
                      <>
                        <td className="col-date date-cell">{formatDateDDMMYYYY(camp.campDate) || '—'}</td>
                        <td className="col-timeframe">
                          <CampTimeFrame camp={camp} compact />
                        </td>
                        <td className="col-state">{cellText(camp.state)}</td>
                        <td className="col-city">{cellText(camp.city)}</td>
                      </>
                    ) : (
                      <>
                        <td className="col-timeframe">
                          <CampTimeFrame camp={camp} compact />
                        </td>
                        <td>{cellText(camp.doctorName)}</td>
                        <td className="col-city">{cellText(camp.city)}</td>
                        <td className="col-date date-cell">{formatDateDDMMYYYY(camp.campDate) || '—'}</td>
                      </>
                    )}
                    <td className="col-status">
                      {renderCampStatus(camp)}
                    </td>
                    <td className="col-actions">{renderCampActions(camp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        pagination={pagination}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="camps"
      />

      <CampActionConfirmModal
        request={confirmRequest}
        cancelDetails={confirmCancelDetails}
        onCancelDetailsChange={setConfirmCancelDetails}
        closureDetails={confirmClosureDetails}
        onClosureDetailsChange={setConfirmClosureDetails}
        reasonDetails={confirmReasonDetails}
        onReasonDetailsChange={setConfirmReasonDetails}
        onConfirm={executeCampActionConfirm}
        onCancel={closeCampActionConfirm}
        loading={confirmLoading}
      />

    </>
  );
}
