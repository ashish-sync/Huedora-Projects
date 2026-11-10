import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DateInput from '../../components/ui/DateInput.jsx';
import { api } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { clientMasterApi } from '../camps/campOpsApi.js';
import { parseOpsBoardFilterCatalog } from '../camps/utils/clientMasterCascade.js';
import { buildOperationsBoardManagePath } from '../camps/utils/campOperationsBoardQuery.js';
import { getWelcomeDefaultDateRange, toDateInputValue } from '../camps/utils/dateRange.js';
import {
  ASSIGNMENT_WORKFLOW_STATUSES,
  EXECUTION_WORKFLOW_STATUSES,
  FINANCIAL_WORKFLOW_STATUSES,
  REQUEST_WORKFLOW_STATUSES,
} from '../camps/constants/campWorkflowStatuses.js';

export function canUsePipelineAdminFilters(user) {
  const role = String(user?.systemRole || '').trim();
  return role === 'Admin' || role === 'Super Admin';
}

/** Canonical Camp One stages — same vocabulary as Operations Board. */
export const PIPELINE_STAGE_DEFINITIONS = [
  { id: 'request', label: 'Request', statuses: REQUEST_WORKFLOW_STATUSES },
  { id: 'assignment', label: 'Assignment', statuses: ASSIGNMENT_WORKFLOW_STATUSES },
  { id: 'execution', label: 'Execution', statuses: EXECUTION_WORKFLOW_STATUSES },
  { id: 'financial', label: 'Financial', statuses: FINANCIAL_WORKFLOW_STATUSES },
];

/** Homepage display labels (aligned to Camp One; short forms where requested). */
const PIPELINE_STATUS_LABELS = {
  review_pending: 'Review Pending',
  review_overdue: 'Review Overdue',
  request_rejected: 'Refusal',
  information_requested: 'Info Requested',
  unassigned: 'Unassigned',
  hiring_requested: 'Hiring Request',
  planned: 'Planned',
  executed: 'Executed',
  cancelled_by_tylo: 'Cancelled by Tylo',
  cancelled_by_client: 'Cancelled by Client',
  payment_not_checked: 'Pending Confirmation',
  payment_confirmed: 'Confirmed Payment',
  payment_hold: 'Hold',
  payment_done: 'Payment Done',
};

const STATUS_TONE = {
  review_pending: 'warn',
  review_overdue: 'danger',
  request_rejected: 'danger',
  information_requested: '',
  unassigned: 'warn',
  hiring_requested: 'warn',
  planned: 'warn',
  executed: 'success',
  cancelled_by_tylo: 'danger',
  cancelled_by_client: 'danger',
  payment_not_checked: 'warn',
  payment_confirmed: 'success',
  payment_hold: 'danger',
  payment_done: 'success',
};

const STAGE_ICONS = {
  request: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  assignment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  execution: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  financial: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
};

function ClearGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function stageNumClass(count, tone) {
  const base = 'tylo-home-stage-num';
  if (!count) return `${base} is-zero`;
  if (tone === 'danger') return `${base} tylo-home-stage-num--danger`;
  if (tone === 'success') return `${base} tylo-home-stage-num--success`;
  if (tone === 'warn') return `${base} tylo-home-stage-num--warn`;
  return base;
}

function countFromStage(stage, statusValue) {
  if (!stage) return 0;
  if (stage.byStatus && Number.isFinite(Number(stage.byStatus[statusValue]))) {
    return Number(stage.byStatus[statusValue]) || 0;
  }
  const row = (stage.statuses || []).find((item) => item.value === statusValue);
  return Number(row?.count) || 0;
}

export function stageDataFromBoard(board) {
  const stages = Array.isArray(board?.stages) ? board.stages : [];
  const byId = Object.fromEntries(stages.map((stage) => [stage.id, stage]));
  const request = byId.request;
  const assignment = byId.assignment;
  const execution = byId.execution;
  const financial = byId.financial;

  const reviewPending = countFromStage(request, 'review_pending');
  const reviewOverdue = countFromStage(request, 'review_overdue');
  const refusals = countFromStage(request, 'request_rejected');
  const infoRequested = countFromStage(request, 'information_requested');
  const unassigned = countFromStage(assignment, 'unassigned');
  const hiringRequested = countFromStage(assignment, 'hiring_requested');
  const planned = countFromStage(execution, 'planned');
  const executed = countFromStage(execution, 'executed');
  const cancelledByTylo = countFromStage(execution, 'cancelled_by_tylo');
  const cancelledByClient = countFromStage(execution, 'cancelled_by_client');
  const pendingConfirmation = countFromStage(financial, 'payment_not_checked');
  const confirmedPayment = countFromStage(financial, 'payment_confirmed');
  const hold = countFromStage(financial, 'payment_hold');
  const paymentDone = countFromStage(financial, 'payment_done');

  return {
    reviewPending,
    reviewOverdue,
    refusals,
    infoRequested,
    unassigned,
    hiringRequested,
    planned,
    executed,
    cancelledByTylo,
    cancelledByClient,
    pendingConfirmation,
    confirmedPayment,
    hold,
    paymentDone,
    requestTotal: Number(request?.total) || reviewPending + reviewOverdue + refusals + infoRequested,
    assignmentTotal: Number(assignment?.total) || unassigned + hiringRequested,
    executionTotal:
      Number(execution?.total) || planned + executed + cancelledByTylo + cancelledByClient,
    financialTotal:
      Number(financial?.total) || pendingConfirmation + confirmedPayment + hold + paymentDone,
  };
}

/** Build the four tiles from the live operations-board payload (same stage/status keys). */
export function pipelineTilesFromBoard(board) {
  const stages = Array.isArray(board?.stages) ? board.stages : [];
  const byId = Object.fromEntries(stages.map((stage) => [stage.id, stage]));

  return PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    const stage = byId[definition.id];
    const statuses = definition.statuses.map((status) => ({
      value: status.value,
      label: PIPELINE_STATUS_LABELS[status.value] || status.label,
      count: countFromStage(stage, status.value),
      tone: STATUS_TONE[status.value] || '',
    }));
    return {
      id: definition.id,
      label: definition.label,
      total: Number(stage?.total) || statuses.reduce((sum, row) => sum + row.count, 0),
      statuses,
    };
  });
}

export default function CampPipelinePanel({ enabled = true, user = null }) {
  const showAdminFilters = canUsePipelineAdminFilters(user);
  const defaultRange = useMemo(() => getWelcomeDefaultDateRange(), []);
  const [draftFrom, setDraftFrom] = useState(defaultRange.dateFrom);
  const [draftTo, setDraftTo] = useState(defaultRange.dateTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultRange.dateFrom);
  const [appliedTo, setAppliedTo] = useState(defaultRange.dateTo);
  const [method, setMethod] = useState('');
  const [assignedUser, setAssignedUser] = useState('');
  const [filterCatalog, setFilterCatalog] = useState(() => parseOpsBoardFilterCatalog());
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const methodSelectId = useId();
  const assignedSelectId = useId();

  useEffect(() => {
    if (!enabled || !showAdminFilters) {
      setFilterCatalog(parseOpsBoardFilterCatalog());
      setCatalogLoading(false);
      return undefined;
    }
    let current = true;
    setCatalogLoading(true);
    clientMasterApi
      .listOpsBoardFilters()
      .then(({ data }) => {
        if (!current) return;
        setFilterCatalog(parseOpsBoardFilterCatalog(data));
      })
      .catch(() => {
        if (!current) return;
        setFilterCatalog(parseOpsBoardFilterCatalog());
      })
      .finally(() => {
        if (current) setCatalogLoading(false);
      });
    return () => {
      current = false;
    };
  }, [enabled, showAdminFilters]);

  useEffect(() => {
    if (!showAdminFilters) {
      setMethod('');
      setAssignedUser('');
    }
  }, [showAdminFilters]);

  useEffect(() => {
    if (!enabled) {
      setBoard(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      dateFrom: appliedFrom,
      dateTo: appliedTo,
    });
    if (showAdminFilters && method) query.set('campaign', method);
    if (showAdminFilters && assignedUser) query.set('assignedUser', assignedUser);

    api(`/dashboards/camp-pipeline?${query.toString()}`)
      .then((response) => {
        if (!current) return;
        if (!response?.data || !Array.isArray(response.data.stages)) {
          throw new Error('Invalid camp pipeline response.');
        }
        setBoard(response.data);
      })
      .catch((err) => {
        if (!current) return;
        setBoard(null);
        setError(err?.message || 'Unable to load camp pipeline.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [enabled, appliedFrom, appliedTo, method, assignedUser, showAdminFilters]);

  const tiles = useMemo(() => pipelineTilesFromBoard(board), [board]);
  const methodOptions = filterCatalog.methods || [];
  const assignedUserOptions = useMemo(
    () =>
      (filterCatalog.assignedUsers || []).map((person) => ({
        email: person.email,
        label: person.name ? `${person.name} · ${person.email}` : person.email,
      })),
    [filterCatalog],
  );

  const manageQuery = useMemo(
    () => ({
      dateFrom: appliedFrom,
      dateTo: appliedTo,
      ...(showAdminFilters && method ? { campaign: method } : {}),
      ...(showAdminFilters && assignedUser ? { assignedUser } : {}),
    }),
    [appliedFrom, appliedTo, method, assignedUser, showAdminFilters],
  );

  function applyRange() {
    const from = draftFrom || toDateInputValue(new Date());
    const to = draftTo || from;
    const orderedFrom = from <= to ? from : to;
    const orderedTo = from <= to ? to : from;
    setDraftFrom(orderedFrom);
    setDraftTo(orderedTo);
    setAppliedFrom(orderedFrom);
    setAppliedTo(orderedTo);
  }

  function clearRange() {
    const next = getWelcomeDefaultDateRange();
    setDraftFrom(next.dateFrom);
    setDraftTo(next.dateTo);
    setAppliedFrom(next.dateFrom);
    setAppliedTo(next.dateTo);
  }

  return (
    <section className="tylo-home-panel tylo-home-pipeline-panel" aria-label="Camp pipeline">
      <div className="tylo-home-card-head tylo-home-pipeline-head">
        <div className="tylo-home-card-head-left">
          <div>
            <h2 className="tylo-home-card-title">Camp Pipeline</h2>
            <p className="tylo-home-card-subtitle">Request through financial status</p>
          </div>
        </div>

        <div
          className={`tylo-home-pipeline-controls${showAdminFilters ? ' tylo-home-pipeline-controls--admin' : ''}`}
        >
          {showAdminFilters ? (
            <label className="tylo-home-pipeline-filter" htmlFor={methodSelectId}>
              <span className="sr-only">{MODULE.METHOD}</span>
              <select
                id={methodSelectId}
                className="tylo-home-welcome-control tylo-home-pipeline-select"
                value={method}
                disabled={catalogLoading}
                aria-label={MODULE.METHOD}
                title={MODULE.METHOD}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="">{catalogLoading ? 'Loading…' : 'Method'}</option>
                {methodOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showAdminFilters ? (
            <label className="tylo-home-pipeline-filter tylo-home-pipeline-filter--users" htmlFor={assignedSelectId}>
              <span className="sr-only">{MODULE.ASSIGNED_USERS}</span>
              <select
                id={assignedSelectId}
                className="tylo-home-welcome-control tylo-home-pipeline-select"
                value={assignedUser}
                disabled={catalogLoading}
                aria-label={MODULE.ASSIGNED_USERS}
                title={MODULE.ASSIGNED_USERS}
                onChange={(event) => setAssignedUser(event.target.value)}
              >
                <option value="">{catalogLoading ? 'Loading…' : 'Assigned Users'}</option>
                {assignedUserOptions.map((option) => (
                  <option key={option.email} value={option.email}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div
            className="tylo-home-pipeline-range"
            role="group"
            aria-label="Camp pipeline date range"
          >
            <DateInput
              hideLabel
              aria-label="Pipeline from date"
              value={draftFrom}
              max={draftTo || undefined}
              onChange={setDraftFrom}
              className="tylo-home-welcome-range-date tylo-home-pipeline-range-date"
            />
            <span className="tylo-home-welcome-range-to">To</span>
            <DateInput
              hideLabel
              aria-label="Pipeline to date"
              value={draftTo}
              min={draftFrom || undefined}
              onChange={setDraftTo}
              className="tylo-home-welcome-range-date tylo-home-pipeline-range-date"
            />
            <button
              type="button"
              className="tylo-home-welcome-range-apply"
              onClick={applyRange}
              disabled={!draftFrom || !draftTo}
              aria-label="Apply pipeline date range"
              title="Apply"
            >
              Apply
            </button>
            <button
              type="button"
              className="tylo-home-welcome-range-clear"
              onClick={clearRange}
              aria-label="Reset pipeline date range"
              title="Reset to current month"
            >
              <ClearGlyph />
            </button>
          </div>
        </div>
      </div>

      {loading && !board ? (
        <p className="tylo-home-pipeline-status">Loading pipeline…</p>
      ) : null}
      {!loading && error ? (
        <p className="tylo-home-pipeline-status tylo-home-pipeline-status--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="tylo-home-pipeline-grid" aria-busy={loading || undefined}>
        {tiles.map((tile) => (
          <div key={tile.id} className={`tylo-home-stage-tile tylo-home-stage-tile--${tile.id}`}>
            <div className="tylo-home-stage-tile-head">
              <Link
                to={buildOperationsBoardManagePath({ stageId: tile.id, ...manageQuery })}
                className="tylo-home-stage-tile-title"
                title={`Open ${tile.label} camps in Manage`}
              >
                <span className={`tylo-home-stage-icon tylo-home-stage-icon--${tile.id}`} aria-hidden="true">
                  {STAGE_ICONS[tile.id]}
                </span>
                <span>{tile.label}</span>
              </Link>
              <span className="tylo-home-stage-tile-count">{tile.total}</span>
            </div>
            <div className="tylo-home-stage-tile-rows">
              {tile.statuses.map((status) => (
                <Link
                  key={status.value}
                  to={buildOperationsBoardManagePath({
                    stageId: tile.id,
                    statusValue: status.value,
                    ...manageQuery,
                  })}
                  className="tylo-home-stage-row-link"
                  title={`Open ${status.label} camps in Manage`}
                >
                  <span>{status.label}</span>
                  <span className={stageNumClass(status.count, status.tone)}>{status.count}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
