import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CampsFilters } from './components/CampsFilters';
import { CampActionConfirmModal } from './components/CampActionConfirmModal';
import { CampRowInfoMenu } from './components/CampRowInfoMenu';
import { Pagination } from './components/Pagination';
import { DEFAULT_PAGE_SIZE } from './constants/pagination';
import { AlertBadge, getCampRowClassName, StatusBadge } from './components/DashboardWidgets';
import { useAuth } from './useCampOpsAuth.js';
import { campApi } from './campOpsApi.js';
import { trimString } from './utils/trimInput';
import { validateBulkCampAction } from './utils/campBulkActions';
import { useAutoDismiss } from './hooks/useAutoDismiss';

import { formatDateDDMMYYYY, formatDateRangeLabel } from './utils/dateFormat';

function buildCancelDetails() {
  return { cancelledBy: 'brand', remarks: '' };
}

export default function CampsPage() {
  const {
    hasPermission,
    isSuperAdmin,
    canApproveCamps,
    canRejectCamps,
    canEditCampRecord,
  } = useAuth();
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [confirmCancelDetails, setConfirmCancelDetails] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const dismissError = useCallback(() => setError(''), []);
  const dismissBulkMessage = useCallback(() => setBulkMessage(''), []);

  useAutoDismiss(error, dismissError);
  useAutoDismiss(bulkMessage, dismissBulkMessage);

  function openCampActionConfirm(action, camp) {
    setConfirmRequest({
      mode: 'single',
      action,
      camp,
    });
    setConfirmCancelDetails(action === 'cancel' ? buildCancelDetails() : null);
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
          : {};
        await runCampAction(action, camp, payload);
      }

      setConfirmRequest(null);
      setConfirmCancelDetails(null);
      await loadCamps();
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
      cancel: campApi.cancel,
      execute: campApi.execute,
      submitReview: campApi.submitReview,
      delete: campApi.delete,
    };

    const handler = handlers[action];
    if (!handler) {
      throw new Error(`Unsupported camp action: ${action}`);
    }

    if (action === 'delete') {
      await handler(camp._id);
      return;
    }

    await handler(camp._id, payload);
  }

  async function loadCamps(nextPage = page, nextLimit = pageSize) {
    setLoading(true);
    const trimmedSearch = trimString(search);
    setSearch(trimmedSearch);
    try {
      const params = { search: trimmedSearch, page: nextPage, limit: nextLimit };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (clientFilter) params.client = clientFilter;
      if (campaignFilter) params.campaign = campaignFilter;
      if (campTypeFilter) params.campaignType = campTypeFilter;
      if (reactionRequired) {
        params.reactionRequired = '1';
      } else if (offHoursOnly) {
        params.offHours = '1';
      } else if (weekendAttentionOnly) {
        params.weekendAttention = '1';
      } else if (overdueOnly) {
        params.overdue = '1';
      } else if (status) {
        params.status = status;
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

  useEffect(() => {
    setPage(1);
    loadCamps(1, pageSize);
  }, [status, overdueOnly, reactionRequired, offHoursOnly, weekendAttentionOnly, dateFrom, dateTo, clientFilter, campaignFilter, campTypeFilter]);

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
  const bulkDeleteValidation = validateBulkCampAction('delete', selectedCamps, bulkAuth);

  return (
    <>
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
        activeChips={activeChips}
        onClearAll={clearFilters}
        showImportLink={hasPermission('import:create')}
      />

      {canBulkManage && selectedIds.length > 0 && (
        <div className="bulk-bar">
          <span>{selectedIds.length} selected</span>
          {canApproveCamps() && (
            <button
              className="btn btn-primary btn-sm"
              disabled={bulkLoading || confirmLoading || !bulkApproveValidation.ok}
              title={!bulkApproveValidation.ok ? bulkApproveValidation.message : undefined}
              onClick={() => handleBulk('approve')}
            >
              Approve Selected
            </button>
          )}
          {canRejectCamps() && (
            <button
              className="btn btn-danger btn-sm"
              disabled={bulkLoading || confirmLoading || !bulkRejectValidation.ok}
              title={!bulkRejectValidation.ok ? bulkRejectValidation.message : undefined}
              onClick={() => handleBulk('reject')}
            >
              Reject Selected
            </button>
          )}
          {hasPermission('camps:execute') && (
            <button
              className="btn btn-primary btn-sm"
              disabled={bulkLoading || confirmLoading || !bulkExecuteValidation.ok}
              title={!bulkExecuteValidation.ok ? bulkExecuteValidation.message : undefined}
              onClick={() => handleBulk('execute')}
            >
              Mark Executed
            </button>
          )}
          {(hasPermission('camps:update') || hasPermission('camps:approve')) && (
            <button
              className="btn btn-danger btn-sm"
              disabled={bulkLoading || confirmLoading || !bulkDeleteValidation.ok}
              title={!bulkDeleteValidation.ok ? bulkDeleteValidation.message : undefined}
              onClick={() => handleBulk('delete')}
            >
              Delete Selected
            </button>
          )}
        </div>
      )}

      {(bulkMessage || error) && (
        <div className="page-alerts">
          {bulkMessage && <div className="success-banner">{bulkMessage}</div>}
          {error && <div className="error-banner">{error}</div>}
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading camps...</div>
        ) : camps.length === 0 ? (
          <div className="empty-state">
            <h3>No camps yet</h3>
            <p>Create a camp or import from Excel to see records here.</p>
            {(hasPermission('camps:create') || hasPermission('camps:update')) && (
              <Link to="/camps/manage/new" className="btn btn-primary">New Camp</Link>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
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
                  {/* <th>Camp ID</th> */}
                  <th>Client Name</th>
                  <th>Division / Business Unit</th>
                  <th>Camp Name</th>
                  <th>Time Frame</th>
                  <th>Doctor</th>
                  <th>City</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
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
                    {/* <td>{camp.campId}</td> */}
                    <td>{camp.clientName}</td>
                    <td>{camp.campaignType}</td>
                    <td>{camp.campaignName}</td>
                    <td>
                      <div>{camp.timeFrame}</div>
                    </td>
                    <td>{camp.doctorName}</td>
                    <td>{camp.city}</td>
                    <td className="date-cell">
                      <div>{formatDateDDMMYYYY(camp.campDate)}</div>
                      {/* <AlertBadge alertLevel={camp.alertLevel} alertReason={camp.alertReason} /> */}
                    </td>
                    <td>
                      <StatusBadge status={camp.status} />
                    </td>
                    <td>
                      <div className="actions camp-row-actions">
                        {canEditCampRecord(camp) && (
                          <Link to={`/camps/manage/${camp._id}/edit`} className="btn btn-secondary btn-sm">
                            Edit
                          </Link>
                        )}
                        {camp.status === 'pending_review' && canApproveCamps() && (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={camp.canApprove === false}
                            title={camp.canApprove === false ? (camp.approvalBlockers || []).join(' ') : undefined}
                            onClick={() => openCampActionConfirm('approve', camp)}
                          >
                            Approve
                          </button>
                        )}
                        {camp.status === 'approved' && hasPermission('camps:execute') && (
                          <button className="btn btn-primary btn-sm" onClick={() => openCampActionConfirm('execute', camp)}>
                            Mark Executed
                          </button>
                        )}
                        <CampRowInfoMenu
                          camp={camp}
                          hasPermission={hasPermission}
                          canRejectCamps={canRejectCamps()}
                          isSuperAdmin={isSuperAdmin}
                          onAction={requestCampAction}
                        />
                      </div>
                    </td>
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
        onConfirm={executeCampActionConfirm}
        onCancel={closeCampActionConfirm}
        loading={confirmLoading}
      />
    </>
  );
}
