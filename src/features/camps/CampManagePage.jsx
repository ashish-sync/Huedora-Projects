import { useCallback, useEffect, useRef, useState } from 'react';
import { PageAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link, useSearchParams } from 'react-router-dom';
import { CampsFilters } from './components/CampsFilters';
import { CampTimeFrame } from './components/CampTimeFrame';
import { CampRowInfoMenu } from './components/CampRowInfoMenu';
import { CampCancelRefuseButton } from './components/CampCancelRefuseButton';
import { CampRequestRowActions } from './components/CampRequestRowActions';
import { CampAssignmentRowActions } from './components/CampAssignmentRowActions';
import { CampExecutionRowActions } from './components/CampExecutionRowActions';
import { CampFinancialRowActions } from './components/CampFinancialRowActions';
import { CampAssignModal } from './components/CampAssignModal';
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
import { useAutoDismiss } from './hooks/useAutoDismiss';

import { formatDateDDMMYYYY, formatDateRangeLabel } from './utils/dateFormat';
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
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === '1');
  const [reactionRequired, setReactionRequired] = useState(searchParams.get('reactionRequired') === '1');
  const [offHoursOnly, setOffHoursOnly] = useState(searchParams.get('offHours') === '1');
  const [weekendAttentionOnly, setWeekendAttentionOnly] = useState(searchParams.get('weekendAttention') === '1');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '');
  const [campaignFilter, setCampaignFilter] = useState(searchParams.get('campaign') || '');
  const [campTypeFilter, setCampTypeFilter] = useState(searchParams.get('campaignType') || '');
  const [search, setSearch] = useState(searchParams.get('findCampId') || searchParams.get('q') || '');
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
  const [assignCamp, setAssignCamp] = useState(null);
  const [hcwContacts, setHcwContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const dismissError = useCallback(() => setError(''), []);
  const dismissBulkMessage = useCallback(() => setBulkMessage(''), []);

  useAutoDismiss(error, dismissError);
  useAutoDismiss(bulkMessage, dismissBulkMessage);

  const findCampFromUrlRef = useRef('');

  useEffect(() => {
    const findCampId = searchParams.get('findCampId') || searchParams.get('q') || '';
    if (!findCampId) return;
    findCampFromUrlRef.current = findCampId;
    setWorkingStage('request');
    setStatus('');
    setOverdueOnly(false);
    setReactionRequired(false);
    setOffHoursOnly(false);
    setWeekendAttentionOnly(false);
    setSearch(findCampId);
    setPage(1);
    loadCamps(1, pageSize, findCampId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        const { data } = await campApi.bulkAction({
          ids: validation.ids,
          action: confirmRequest.action,
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
            ? buildClosurePayload(confirmClosureDetails)
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
        setWorkingStage('financial');
        setBulkMessage(
          executedBulk
            ? 'Camps marked executed. They are now in Finance & Settlement.'
            : 'Camp marked executed. It is now in Finance & Settlement — complete payout details there.'
        );
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
      if (reactionRequired) {
        params.reactionRequired = '1';
      } else if (offHoursOnly) {
        params.offHours = '1';
      } else if (weekendAttentionOnly) {
        params.weekendAttention = '1';
      } else if (overdueOnly) {
        params.overdue = '1';
      } else if (status) {
        if (workingStage === 'assignment') {
          params.assignmentFilter = status;
        } else if (workingStage === 'execution') {
          params.executionFilter = status;
        } else if (workingStage === 'financial') {
          params.financialFilter = status;
        } else if (status === 'information_requested') {
          params.requestReviewStatus = 'information_requested';
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

  useEffect(() => {
    const nextOverdue = searchParams.get('overdue') === '1';
    const nextReactionRequired = searchParams.get('reactionRequired') === '1';
    const nextOffHours = searchParams.get('offHours') === '1';
    const nextWeekendAttention = searchParams.get('weekendAttention') === '1';
    const hasAlertFilter = nextReactionRequired || nextOffHours || nextWeekendAttention;
    setStatus(hasAlertFilter || nextOverdue ? '' : (searchParams.get('status') || ''));
    setOverdueOnly(nextOverdue);
    setReactionRequired(nextReactionRequired);
    setOffHoursOnly(nextOffHours);
    setWeekendAttentionOnly(nextWeekendAttention);
    setDateFrom(searchParams.get('dateFrom') || '');
    setDateTo(searchParams.get('dateTo') || '');
    setClientFilter(searchParams.get('client') || '');
    setCampaignFilter(searchParams.get('campaign') || '');
    setCampTypeFilter(searchParams.get('campaignType') || '');
  }, [searchParams]);

  const previousWorkingStageRef = useRef(workingStage);
  useEffect(() => {
    if (previousWorkingStageRef.current === workingStage) return;
    previousWorkingStageRef.current = workingStage;
    setStatus('');
    setOverdueOnly(false);
    setReactionRequired(false);
    setOffHoursOnly(false);
    setWeekendAttentionOnly(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('assignmentFilter');
      next.delete('requestReviewStatus');
      next.delete('executionFilter');
      next.delete('financialFilter');
      next.delete('status');
      next.delete('overdue');
      next.delete('reactionRequired');
      next.delete('offHours');
      next.delete('weekendAttention');
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
  }, [status, overdueOnly, reactionRequired, offHoursOnly, weekendAttentionOnly, dateFrom, dateTo, clientFilter, campaignFilter, campTypeFilter, workingStage]);

  useEffect(() => {
    if (workingStage !== 'assignment') return undefined;
    let cancelled = false;
    setContactsLoading(true);
    api('/contacts?contactCategory=Healthcare Worker&limit=500')
      .then((res) => {
        if (!cancelled) setHcwContacts(res.data || []);
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
  }, [workingStage]);

  function handleSearch() {
    setPage(1);
    loadCamps(1, pageSize);
  }

  function handlePageChange(nextPage) {
    loadCamps(nextPage, pageSize);
  }

  function handlePageSizeChange(nextPageSize) {
    setPage(1);
    loadCamps(1, nextPageSize);
  }

  function buildFilterParams(overrides = {}) {
    const params = new URLSearchParams();
    const nextReactionRequired = overrides.reactionRequired ?? reactionRequired;
    const nextOffHours = overrides.offHours ?? offHoursOnly;
    const nextWeekendAttention = overrides.weekendAttention ?? weekendAttentionOnly;
    const nextOverdue = overrides.overdue ?? overdueOnly;
    const nextStatus = overrides.status ?? status;
    const nextDateFrom = overrides.dateFrom ?? dateFrom;
    const nextDateTo = overrides.dateTo ?? dateTo;
    const nextClient = overrides.client ?? clientFilter;
    const nextCampaign = overrides.campaign ?? campaignFilter;
    const nextCampType = overrides.campaignType ?? campTypeFilter;

    if (nextReactionRequired) params.set('reactionRequired', '1');
    else if (nextOffHours) params.set('offHours', '1');
    else if (nextWeekendAttention) params.set('weekendAttention', '1');
    else if (nextOverdue) params.set('overdue', '1');
    else if (nextStatus) params.set('status', nextStatus);
    if (nextDateFrom) params.set('dateFrom', nextDateFrom);
    if (nextDateTo) params.set('dateTo', nextDateTo);
    if (nextClient) params.set('client', nextClient);
    if (nextCampaign) params.set('campaign', nextCampaign);
    if (nextCampType) params.set('campaignType', nextCampType);
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
    setOverdueOnly(false);
    setReactionRequired(false);
    setOffHoursOnly(false);
    setWeekendAttentionOnly(false);
    setStatus(value);
    updateFilters({
      status: value,
      overdue: false,
      reactionRequired: false,
      offHours: false,
      weekendAttention: false,
    });
  }

  function clearFilters() {
    setStatus('');
    setOverdueOnly(false);
    setReactionRequired(false);
    setOffHoursOnly(false);
    setWeekendAttentionOnly(false);
    setDateFrom('');
    setDateTo('');
    setClientFilter('');
    setCampaignFilter('');
    setCampTypeFilter('');
    setSearch('');
    setSearchParams({});
  }

  function handleFilterChange(value) {
    if (value === 'reaction_required') {
      updateFilters({
        status: '',
        overdue: false,
        reactionRequired: true,
        offHours: false,
        weekendAttention: false,
      });
      return;
    }
    if (value === 'off_hours') {
      updateFilters({
        status: '',
        overdue: false,
        reactionRequired: false,
        offHours: true,
        weekendAttention: false,
      });
      return;
    }
    if (value === 'weekend_attention') {
      updateFilters({
        status: '',
        overdue: false,
        reactionRequired: false,
        offHours: false,
        weekendAttention: true,
      });
      return;
    }
    if (value === 'overdue') {
      updateFilters({
        status: '',
        overdue: true,
        reactionRequired: false,
        offHours: false,
        weekendAttention: false,
      });
      return;
    }
    handleStatusChange(value);
  }

  const filterValue = reactionRequired
    ? 'reaction_required'
    : offHoursOnly
      ? 'off_hours'
      : weekendAttentionOnly
        ? 'weekend_attention'
        : overdueOnly
          ? 'overdue'
          : status;

  const activeChips = [];
  if (reactionRequired) {
    activeChips.push({
      key: 'reaction',
      label: 'Reaction required',
      onRemove: () => handleFilterChange(''),
    });
  } else if (offHoursOnly) {
    activeChips.push({
      key: 'off_hours',
      label: 'Off-hours submissions',
      onRemove: () => handleFilterChange(''),
    });
  } else if (weekendAttentionOnly) {
    activeChips.push({
      key: 'weekend',
      label: 'Weekend / late Saturday',
      onRemove: () => handleFilterChange(''),
    });
  } else if (overdueOnly) {
    activeChips.push({
      key: 'overdue',
      label: 'Overdue — not executed',
      onRemove: () => handleFilterChange(''),
    });
  } else if (status) {
    activeChips.push({
      key: 'status',
      label: status.replaceAll('_', ' '),
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
      onRemove: () => updateFilters({ client: '' }),
    });
  }
  if (campaignFilter) {
    activeChips.push({
      key: 'campaign',
      label: 'Campaign / division',
      onRemove: () => updateFilters({ campaign: '' }),
    });
  }
  if (campTypeFilter) {
    activeChips.push({
      key: 'campType',
      label: `Camp type: ${campTypeFilter}`,
      onRemove: () => updateFilters({ campaignType: '' }),
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

  const canBulkManage = canApproveCamps()
    || canRejectCamps()
    || hasPermission('camps:update')
    || hasPermission('camps:execute');

  const selectedCamps = camps.filter((camp) => selectedIds.includes(camp._id));
  const bulkAuth = getBulkAuth();
  const bulkApproveValidation = validateBulkCampAction('approve', selectedCamps, bulkAuth);
  const bulkRejectValidation = validateBulkCampAction('reject', selectedCamps, bulkAuth);
  const bulkExecuteValidation = validateBulkCampAction('execute', selectedCamps, bulkAuth);

  const isRequestStage = workingStage === 'request';
  const isAssignmentStage = workingStage === 'assignment';
  const isExecutionStage = workingStage === 'execution';
  const isFinancialStage = workingStage === 'financial';
  const canExecuteCamps = hasPermission('camps:execute');

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
          onAction={requestCampAction}
        />
      );
    }

    if (isExecutionStage) {
      return (
        <CampExecutionRowActions
          camp={camp}
          canEdit={canEditCampRecord(camp)}
          canExecute={canExecuteCamps}
          canRejectCamps={canRejectCamps()}
          hasPermission={hasPermission}
          onExecute={() => openCampActionConfirm('execute', camp)}
          onAction={requestCampAction}
        />
      );
    }

    if (isFinancialStage) {
      return (
        <CampFinancialRowActions
          camp={camp}
          canEdit={canEditCampRecord(camp)}
        />
      );
    }

    return (
      <div className="actions camp-row-actions">
        {canEditCampRecord(camp) && (
          <Link to={`/camps/manage/${camp._id}/edit`} className="btn secondary btn-compact">
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
          <button className="btn btn-compact" onClick={() => openCampActionConfirm('execute', camp)}>
            Mark Executed
          </button>
        )}
        {cancelRefuse}
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

        {canBulkManage && selectedIds.length > 0 && !isAssignmentStage && (
          <div className="bulk-bar camps-manage-bulk-bar">
          <span>{selectedIds.length} selected</span>
          {canApproveCamps() && (
            <button
              className="btn btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkApproveValidation.ok}
              title={!bulkApproveValidation.ok ? bulkApproveValidation.message : undefined}
              onClick={() => handleBulk('approve')}
            >
              Approve Selected
            </button>
          )}
          {canRejectCamps() && (
            <button
              className="btn danger btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkRejectValidation.ok}
              title={!bulkRejectValidation.ok ? bulkRejectValidation.message : undefined}
              onClick={() => handleBulk('reject')}
            >
              Refuse Selected
            </button>
          )}
          {hasPermission('camps:execute') && (
            <button
              className="btn btn-compact"
              disabled={bulkLoading || confirmLoading || !bulkExecuteValidation.ok}
              title={!bulkExecuteValidation.ok ? bulkExecuteValidation.message : undefined}
              onClick={() => handleBulk('execute')}
            >
              Mark Executed
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
                <Link to="/camps/manage/new" className="btn">New Camp</Link>
              ) : null
            }
          />
        ) : (
          <div className="table-scroll">
            <table className={isRequestStage ? 'camps-table camps-table--request' : 'camps-table'}>
              <thead>
                <tr>
                  {canBulkManage && (
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
                    {canBulkManage && (
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
                        <td>{camp.doctorName}</td>
                        <td className="col-city">{cellText(camp.city)}</td>
                        <td className="col-date date-cell">
                          <div>{formatDateDDMMYYYY(camp.campDate)}</div>
                        </td>
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

      {assignCamp && (
        <CampAssignModal
          camp={assignCamp}
          hcwContacts={hcwContacts}
          contactsLoading={contactsLoading}
          onClose={() => setAssignCamp(null)}
          onSaved={() => {
            setAssignCamp(null);
            loadCamps(page, pageSize);
          }}
        />
      )}
    </>
  );
}
