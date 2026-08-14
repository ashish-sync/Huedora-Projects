import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FeedbackBanner from '../../../components/ui/FeedbackBanner.jsx';
import { DateRangeFilters } from './DateRangeFilters';
import { dashboardApi, campApi } from '../campOpsApi.js';
import { CAMP_PATH, campManageEditPath } from '../../../shared/moduleRoutes.js';
import { formatDateDDMMYYYY } from '../utils/dateFormat.js';
import {
  RequestReviewStatusBadge,
  AssignmentStatusBadge,
  ExecutionStatusBadge,
  FinanceSettlementStatusBadge,
} from './DashboardWidgets.jsx';
import '../campOps.css';
import '../campOps.theme.css';
import '../../../styles/components/search-field.css';

const EMPTY_RANGE = { dateFrom: '', dateTo: '' };

function StatusBadgeForStage({ stageId, camp }) {
  if (stageId === 'request') return <RequestReviewStatusBadge camp={camp} />;
  if (stageId === 'assignment') return <AssignmentStatusBadge camp={camp} />;
  if (stageId === 'execution') return <ExecutionStatusBadge camp={camp} />;
  return <FinanceSettlementStatusBadge camp={camp} />;
}

function buildManagePath({ stageId, statusValue = '', dateFrom = '', dateTo = '' } = {}) {
  const params = new URLSearchParams();
  if (stageId) params.set('stage', stageId);
  if (statusValue) params.set('status', statusValue);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const query = params.toString();
  return `${CAMP_PATH.MANAGE}${query ? `?${query}` : ''}`;
}

function buildListParams({ stageId, statusValue, dateFrom, dateTo, search, page = 1 }) {
  const params = {
    page,
    limit: 50,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  if (!statusValue) {
    if (stageId === 'execution') {
      params.boardStage = 'execution';
    } else {
      params.lifecycleStage = stageId;
    }
    return params;
  }

  if (stageId === 'request') {
    params.lifecycleStage = 'request';
    params.requestReviewStatus = statusValue;
  } else if (stageId === 'assignment') {
    params.lifecycleStage = 'assignment';
    params.assignmentFilter = statusValue;
  } else if (stageId === 'execution') {
    if (statusValue === 'cancelled_by_tylo' || statusValue === 'cancelled_by_client') {
      params.lifecycleStage = 'financial';
      params.executionFilter = statusValue;
    } else {
      params.lifecycleStage = 'execution';
      params.executionFilter = statusValue;
    }
  } else if (stageId === 'financial') {
    params.lifecycleStage = 'financial';
    params.financialFilter = statusValue;
  }

  return params;
}

function OperationsPivotPanel({
  selection,
  dateFrom,
  dateTo,
  onClose,
  onOpenCamp,
}) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const title = selection?.statusLabel
    ? `${selection.stageLabel} · ${selection.statusLabel}`
    : selection?.stageLabel || 'Camps';

  const load = useCallback(async (page = 1, searchValue = appliedSearch) => {
    if (!selection?.stageId) return;
    setLoading(true);
    try {
      const params = buildListParams({
        stageId: selection.stageId,
        statusValue: selection.statusValue || '',
        dateFrom,
        dateTo,
        search: searchValue,
        page,
      });
      const { data } = await campApi.list(params);
      setRows(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || null);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load camps');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selection, dateFrom, dateTo, appliedSearch]);

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
  }, [selection?.stageId, selection?.statusValue]);

  useEffect(() => {
    load(1, appliedSearch);
  }, [load, appliedSearch]);

  return (
    <aside className="ops-board-pivot" aria-label="Camp pivot list">
      <header className="ops-board-pivot__header">
        <div>
          <p className="ops-board-pivot__eyebrow">Pivot list</p>
          <h3>{title}</h3>
          <p className="meta-text">
            {pagination?.total != null ? `${pagination.total} camp${pagination.total === 1 ? '' : 's'}` : '—'}
            {selection?.count != null ? ` · board count ${selection.count}` : ''}
          </p>
        </div>
        <button type="button" className="btn secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </header>

      <form
        className="ops-board-pivot__filters"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
        }}
      >
        <input
          className="search-field"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by camp ID, client, doctor, city…"
          aria-label="Filter pivot camps"
        />
        <button type="submit" className="btn secondary btn-sm">Apply</button>
      </form>

      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
      {loading ? <p className="meta-text">Loading camps…</p> : null}

      {!loading && !rows.length ? (
        <p className="empty-state ops-board-pivot__empty">No camps in this slice.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="ops-board-pivot__table-wrap">
          <table className="data-table ops-board-pivot__table">
            <thead>
              <tr>
                <th>Camp ID</th>
                <th>Client</th>
                <th>Division / Method</th>
                <th>Date</th>
                <th>Doctor</th>
                <th>HCW</th>
                <th>City</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((camp) => (
                <tr key={camp._id}>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => onOpenCamp(camp)}
                    >
                      {camp.campId || camp._id}
                    </button>
                  </td>
                  <td>{camp.clientName || '—'}</td>
                  <td>
                    {[camp.campaignType, camp.campaignName].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td>{formatDateDDMMYYYY(camp.campDate) || '—'}</td>
                  <td>{camp.doctorName || '—'}</td>
                  <td>{camp.hcwName || '—'}</td>
                  <td>{camp.city || '—'}</td>
                  <td>
                    <StatusBadgeForStage stageId={selection.stageId} camp={camp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <div className="ops-board-pivot__pager">
          <button
            type="button"
            className="btn secondary btn-sm"
            disabled={pagination.page <= 1 || loading}
            onClick={() => load(pagination.page - 1)}
          >
            Previous
          </button>
          <span className="meta-text">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn secondary btn-sm"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => load(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </aside>
  );
}

/** Camp One lifecycle operations board (Module Review → Camp One). */
export default function CampOperationsBoard({
  embedded = false,
  initialFrom = '',
  initialTo = '',
} = {}) {
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(initialFrom || '');
  const [dateTo, setDateTo] = useState(initialTo || '');
  const [appliedRange, setAppliedRange] = useState({
    dateFrom: initialFrom || '',
    dateTo: initialTo || '',
  });
  const [selection, setSelection] = useState(null);

  const loadBoard = useCallback(async (range = appliedRange) => {
    try {
      const { data } = await dashboardApi.operations(range);
      setBoard(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load operations board');
    }
  }, [appliedRange]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const next = { dateFrom: initialFrom || '', dateTo: initialTo || '' };
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setAppliedRange(next);
    setSelection(null);
  }, [initialFrom, initialTo]);

  function applyRange(range) {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setAppliedRange(range);
    setSelection(null);
  }

  const stages = useMemo(() => board?.stages || [], [board]);

  function openSlice({ stageId, stageLabel, statusValue = '', statusLabel = '', count }) {
    setSelection({
      stageId,
      stageLabel,
      statusValue,
      statusLabel,
      count,
    });
  }

  function openCamp(camp) {
    if (!camp?._id) return;
    navigate(campManageEditPath(camp._id));
  }

  if (error && !board) {
    return <FeedbackBanner variant="error">{error}</FeedbackBanner>;
  }

  if (!board) {
    return <div className="empty-state">Loading operations board…</div>;
  }

  return (
    <div className={`camp-ops-root ops-board-host${embedded ? ' ops-board-host--embedded' : ''}`}>
      <div className={`ops-board ${selection ? 'ops-board--split' : ''}`}>
        <div className="ops-board__main">
          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}

          <section className={`ops-board-hero${embedded ? ' ops-board-hero--embedded' : ''}`} aria-label="Total camps">
            <button
              type="button"
              className="ops-board-hero__total"
              onClick={() => setSelection(null)}
              title="Clear pivot selection"
            >
              <span className="ops-board-hero__label">Total Camps</span>
              <strong className="ops-board-hero__value">{board.total ?? 0}</strong>
            </button>
            <div className="ops-board-hero__meta">
              <p className="meta-text">
                Scoped to your Camp One access
                {board.scope?.designation ? ` · ${board.scope.designation}` : ''}
              </p>
              {!embedded ? (
                <DateRangeFilters
                  idPrefix="ops-board-date"
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  appliedFrom={appliedRange.dateFrom}
                  appliedTo={appliedRange.dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onApply={() => applyRange({ dateFrom, dateTo })}
                  onQuickSelect={(range) => applyRange(range)}
                  onClear={() => applyRange(EMPTY_RANGE)}
                  showClear={Boolean(appliedRange.dateFrom || appliedRange.dateTo)}
                />
              ) : null}
            </div>
          </section>

          <section className="ops-board-grid" aria-label="Lifecycle stage board">
            {stages.map((stage) => (
              <article key={stage.id} className={`ops-board-card ops-board-card--${stage.id}`}>
                <header className="ops-board-card__header">
                  <button
                    type="button"
                    className="ops-board-card__stage"
                    onClick={() => openSlice({
                      stageId: stage.id,
                      stageLabel: stage.label,
                      count: stage.total,
                    })}
                  >
                    <span>{stage.label}</span>
                    <strong>{stage.total}</strong>
                  </button>
                </header>
                <ul className="ops-board-card__statuses">
                  {(stage.statuses || []).map((row) => {
                    const active = selection?.stageId === stage.id
                      && selection?.statusValue === row.value;
                    return (
                      <li key={row.value}>
                        <button
                          type="button"
                          className={[
                            'ops-board-status',
                            `ops-board-status--${row.value}`,
                            row.attention ? 'is-attention' : '',
                            active ? 'is-active' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => openSlice({
                            stageId: stage.id,
                            stageLabel: stage.label,
                            statusValue: row.value,
                            statusLabel: row.label,
                            count: row.count,
                          })}
                        >
                          <span className="ops-board-status__label">{row.label}</span>
                          <span className="ops-board-status__count">{row.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <footer className="ops-board-card__footer">
                  <Link
                    className="meta-text"
                    to={buildManagePath({
                      stageId: stage.id,
                      dateFrom: appliedRange.dateFrom,
                      dateTo: appliedRange.dateTo,
                    })}
                  >
                    Open in Manage →
                  </Link>
                </footer>
              </article>
            ))}
          </section>
        </div>

        {selection ? (
          <OperationsPivotPanel
            selection={selection}
            dateFrom={appliedRange.dateFrom}
            dateTo={appliedRange.dateTo}
            onClose={() => setSelection(null)}
            onOpenCamp={openCamp}
          />
        ) : null}
      </div>
    </div>
  );
}
