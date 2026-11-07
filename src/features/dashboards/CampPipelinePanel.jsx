import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DateInput from '../../components/ui/DateInput.jsx';
import { api } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { clientMasterApi } from '../camps/campOpsApi.js';
import { parseOpsBoardFilterCatalog } from '../camps/utils/clientMasterCascade.js';
import { getWelcomeDefaultDateRange, toDateInputValue } from '../camps/utils/dateRange.js';

export function canUsePipelineAdminFilters(user) {
  const role = String(user?.systemRole || '').trim();
  return role === 'Admin' || role === 'Super Admin';
}

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

const EMPTY_STAGE_DATA = stageDataFromBoard(null);

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

  const stageData = useMemo(() => stageDataFromBoard(board), [board]);
  const methodOptions = filterCatalog.methods || [];
  const assignedUserOptions = useMemo(
    () =>
      (filterCatalog.assignedUsers || []).map((person) => ({
        email: person.email,
        label: person.name ? `${person.name} · ${person.email}` : person.email,
      })),
    [filterCatalog]
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

  const display = board ? stageData : EMPTY_STAGE_DATA;

  return (
    <section className="tylo-home-panel tylo-home-pipeline-panel" aria-label="Camp pipeline">
      <div className="tylo-home-card-head tylo-home-pipeline-head">
        <div className="tylo-home-card-head-left">
          <span className="tylo-home-card-head-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
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
        <div className="tylo-home-stage-tile tylo-home-stage-tile--request">
          <div className="tylo-home-stage-tile-head">
            <div className="tylo-home-stage-tile-title"><span>Request</span></div>
            <span className="tylo-home-stage-tile-count">{display.requestTotal}</span>
          </div>
          <div className="tylo-home-stage-tile-rows">
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Review Pending</span>
              <span className={stageNumClass(display.reviewPending)}>{display.reviewPending}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Review Overdue</span>
              <span className={stageNumClass(display.reviewOverdue, 'danger')}>{display.reviewOverdue}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Refusals</span>
              <span className={stageNumClass(display.refusals)}>{display.refusals}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Info Requested</span>
              <span className={stageNumClass(display.infoRequested)}>{display.infoRequested}</span>
            </Link>
          </div>
        </div>

        <div className="tylo-home-stage-tile tylo-home-stage-tile--assignment">
          <div className="tylo-home-stage-tile-head">
            <div className="tylo-home-stage-tile-title"><span>Assignment</span></div>
            <span className="tylo-home-stage-tile-count">{display.assignmentTotal}</span>
          </div>
          <div className="tylo-home-stage-tile-rows">
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Unassigned</span>
              <span className={stageNumClass(display.unassigned)}>{display.unassigned}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Hiring Requested</span>
              <span className={stageNumClass(display.hiringRequested)}>{display.hiringRequested}</span>
            </Link>
          </div>
        </div>

        <div className="tylo-home-stage-tile tylo-home-stage-tile--execution">
          <div className="tylo-home-stage-tile-head">
            <div className="tylo-home-stage-tile-title"><span>Execution</span></div>
            <span className="tylo-home-stage-tile-count">{display.executionTotal}</span>
          </div>
          <div className="tylo-home-stage-tile-rows">
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Planned</span>
              <span className={stageNumClass(display.planned, 'warn')}>{display.planned}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Executed</span>
              <span className={stageNumClass(display.executed, 'success')}>{display.executed}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Cancelled by Tylo</span>
              <span className={stageNumClass(display.cancelledByTylo, 'danger')}>{display.cancelledByTylo}</span>
            </Link>
            <Link to="/camps/manage" className="tylo-home-stage-row-link">
              <span>Cancelled by Client</span>
              <span className={stageNumClass(display.cancelledByClient, 'danger')}>{display.cancelledByClient}</span>
            </Link>
          </div>
        </div>

        <div className="tylo-home-stage-tile tylo-home-stage-tile--financial">
          <div className="tylo-home-stage-tile-head">
            <div className="tylo-home-stage-tile-title"><span>Financial</span></div>
            <span className="tylo-home-stage-tile-count">{display.financialTotal}</span>
          </div>
          <div className="tylo-home-stage-tile-rows">
            <Link to="/finance" className="tylo-home-stage-row-link">
              <span>Pending Confirmation</span>
              <span className={stageNumClass(display.pendingConfirmation)}>{display.pendingConfirmation}</span>
            </Link>
            <Link to="/finance" className="tylo-home-stage-row-link">
              <span>Confirmed Payment</span>
              <span className={stageNumClass(display.confirmedPayment, 'success')}>{display.confirmedPayment}</span>
            </Link>
            <Link to="/finance" className="tylo-home-stage-row-link">
              <span>Hold</span>
              <span className={stageNumClass(display.hold, 'danger')}>{display.hold}</span>
            </Link>
            <Link to="/finance" className="tylo-home-stage-row-link">
              <span>Payment Done</span>
              <span className={stageNumClass(display.paymentDone, 'success')}>{display.paymentDone}</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
