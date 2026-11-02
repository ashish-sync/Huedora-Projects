import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import PageShell from '../../components/ui/PageShell.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { ACTIVITY_MODULES, ACTIVITY_STATUSES, describeActivity } from './activityLogCatalog.js';
import { OpsReviewSlot } from '../dashboards/OpsReviewHeader.jsx';
import './activityLog.css';
import '../notifications/notifications.css';

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultActivityRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: ymd(from), to: ymd(to) };
}

function StatusPill({ status, failed }) {
  return (
    <span className={`activity-log-status${failed ? ' activity-log-status--bad' : ' activity-log-status--ok'}`}>
      <span aria-hidden="true">{failed ? '✕' : '✓'}</span>
      {status}
    </span>
  );
}

function ActivityDetail({ row, described, canSeeTechnical, onClose }) {
  return (
    <section className="card activity-log-detail" aria-label="Activity details">
      <div className="activity-log-detail__header">
        <StatusPill status={described.status} failed={described.failed} />
        {onClose ? (
          <button type="button" className="btn ghost btn-compact" onClick={onClose} aria-label="Close activity detail">
            Close
          </button>
        ) : null}
      </div>

      <h3>{described.title}</h3>
      <p className="activity-log-detail__summary">{described.summary}</p>

      <dl className="activity-log-facts">
        <div>
          <dt>Employee</dt>
          <dd>{described.employee}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{formatDateTime(row.at)}</dd>
        </div>
        <div>
          <dt>Module</dt>
          <dd>{described.moduleLabel}</dd>
        </div>
        {described.subject ? (
          <div>
            <dt>Record</dt>
            <dd>{described.subject}</dd>
          </div>
        ) : null}
        <div>
          <dt>Outcome</dt>
          <dd>{described.status}</dd>
        </div>
      </dl>

      {described.changes.length ? (
        <div className="activity-diff-section">
          <p className="activity-diff-label">What changed</p>
          <ul className="nc-changes">
            {described.changes.map((change) => (
              <li key={change.field}>
                <span className="nc-change-label">{change.label}</span>
                <span className="nc-change-values">
                  <span className="nc-from">{change.from}</span>
                  <span aria-hidden="true"> → </span>
                  <span className="nc-to">{change.to}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : row.message ? (
        <p className="muted">{row.message}</p>
      ) : (
        <p className="muted">No further business details were stored for this activity.</p>
      )}

      {canSeeTechnical ? (
        <details className="activity-log-tech">
          <summary>Technical details</summary>
          <dl className="activity-log-facts" style={{ marginTop: '8px' }}>
            <div>
              <dt>Event code</dt>
              <dd><code className="mono-sm">{row.action || '-'}</code></dd>
            </div>
            <div>
              <dt>Record type</dt>
              <dd><code className="mono-sm">{row.entityType || '-'}</code></dd>
            </div>
            <div>
              <dt>Record id</dt>
              <dd><code className="mono-sm">{row.entityId ? String(row.entityId) : '-'}</code></dd>
            </div>
            {row.ip ? (
              <div>
                <dt>IP Address</dt>
                <dd><code className="mono-sm">{row.ip}</code></dd>
              </div>
            ) : null}
            <div>
              <dt>Raw Timestamp</dt>
              <dd><code className="mono-sm">{row.at || '-'}</code></dd>
            </div>
          </dl>
        </details>
      ) : null}
    </section>
  );
}

export default function AuditPage({
  embedded = false,
  initialFrom = '',
  initialTo = '',
} = {}) {
  const { can, isAdmin } = useAuth();
  const canRead = can('audit:read');
  const canSeeTechnical = Boolean(isAdmin?.());
  const [view, setView] = useState('activity');
  const [rows, setRows] = useState([]);
  const [moduleId, setModuleId] = useState('');
  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('');
  const fallbackRange = defaultActivityRange();
  const [from, setFrom] = useState(initialFrom || fallbackRange.from);
  const [to, setTo] = useState(initialTo || fallbackRange.to);
  const [applied, setApplied] = useState({
    module: '',
    employee: '',
    status: '',
    from: initialFrom || fallbackRange.from,
    to: initialTo || fallbackRange.to,
  });
  const [detailRow, setDetailRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    const next = defaultActivityRange();
    const nextFrom = initialFrom || next.from;
    const nextTo = initialTo || next.to;
    setFrom(nextFrom);
    setTo(nextTo);
    setApplied((prev) => ({
      ...prev,
      from: nextFrom,
      to: nextTo,
    }));
  }, [initialFrom, initialTo]);

  useEffect(() => {
    if (!selectedId) {
      setDetailRow(null);
      return undefined;
    }
    const listed = rows.find((row) => row._id === selectedId);
    setDetailRow(listed || null);
    let cancelled = false;
    api(`/audit-logs/${selectedId}`)
      .then((r) => {
        if (!cancelled && r?.data && !Array.isArray(r.data)) setDetailRow(r.data);
      })
      .catch(() => {
        /* keep the slim list row */
      });
    return () => { cancelled = true; };
  }, [selectedId, rows]);

  const load = (filters = applied, pageNum = page, pageLimit = limit) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(pageLimit),
    });
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', `${filters.to}T23:59:59.999`);
    if (filters.module) params.set('module', filters.module);
    if (filters.employee) params.set('employee', filters.employee);
    if (filters.status) params.set('status', filters.status);
    api(`/audit-logs?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setListMeta(r.meta || { page: pageNum, limit: pageLimit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canRead) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when page/limit change
  }, [page, limit, canRead, applied.from, applied.to, applied.module, applied.employee, applied.status]);

  if (!canRead) return <p className="error">You do not have access to the Activity Log.</p>;

  const submitFilters = (e) => {
    e?.preventDefault?.();
    if (from && to && from > to) {
      setError('From date must be on or before To date');
      return;
    }
    const next = {
      module: moduleId,
      employee: employee.trim(),
      status,
      from,
      to,
    };
    setApplied(next);
    setPage(1);
    setSelectedId('');
  };

  const clearFilters = () => {
    setModuleId('');
    setEmployee('');
    setStatus('');
    const fallback = defaultActivityRange();
    const nextFrom = embedded ? initialFrom || fallback.from : fallback.from;
    const nextTo = embedded ? initialTo || fallback.to : fallback.to;
    setFrom(nextFrom);
    setTo(nextTo);
    setApplied({ module: '', employee: '', status: '', from: nextFrom, to: nextTo });
    setPage(1);
    setSelectedId('');
  };

  const selected = detailRow || rows.find((row) => row._id === selectedId);
  const selectedDescribed = selected ? describeActivity(selected) : null;

  const applyEmbedded = (patch) => {
    const next = {
      module: moduleId,
      employee: employee.trim(),
      status,
      from,
      to,
      ...patch,
    };
    setApplied(next);
    setPage(1);
    setSelectedId('');
  };

  const filterClass = embedded ? 'ops-review-header__filter' : 'date-range-filter-field';
  const filterFields = (
    <>
      <label className={filterClass}>
        <span>Module</span>
        <AdaptiveSelect
          aria-label="Module"
          value={moduleId}
          onChange={(e) => {
            const next = e.target.value;
            setModuleId(next);
            if (embedded) applyEmbedded({ module: next });
          }}
        >
          <option value="">All modules</option>
          {ACTIVITY_MODULES.map((mod) => (
            <option key={mod.id} value={mod.id}>{mod.label}</option>
          ))}
        </AdaptiveSelect>
      </label>
      <label className={filterClass}>
        <span>Employee</span>
        <input
          className="ops-filter-input"
          value={employee}
          onChange={(e) => {
            setEmployee(e.target.value);
            if (embedded) applyEmbedded({ employee: e.target.value.trim() });
          }}
          placeholder="Name or email"
          aria-label="Employee"
        />
      </label>
      <label className={filterClass}>
        <span>Status</span>
        <AdaptiveSelect
          aria-label="Status"
          value={status}
          onChange={(e) => {
            const next = e.target.value;
            setStatus(next);
            if (embedded) applyEmbedded({ status: next });
          }}
        >
          <option value="">All statuses</option>
          {ACTIVITY_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </AdaptiveSelect>
      </label>
    </>
  );

  const toolbar = (
    <DateRangeFilter
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      onSubmit={submitFilters}
      onClear={clearFilters}
      submitting={loading}
    >
      {filterFields}
    </DateRangeFilter>
  );

  return (
    <PageShell
      bare={embedded}
      breadcrumbs={embedded ? [] : [{ to: '/', label: MODULE.HOME }, { label: MODULE.ACTIVITY_LOG }]}
      title={embedded ? '' : MODULE.ACTIVITY_LOG}
      description={
        embedded
          ? ''
          : 'Unified audit trail of actions, approvals, transitions, and system changes across TYLO ONE.'
      }
      actions={
        canSeeTechnical ? (
          <div className="activity-log-view" role="tablist" aria-label="Activity views">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'activity'}
              className={`ops-view-chip${view === 'activity' ? ' is-active' : ''}`}
              onClick={() => setView('activity')}
            >
              Activity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'technical'}
              className={`ops-view-chip${view === 'technical' ? ' is-active' : ''}`}
              onClick={() => setView('technical')}
            >
              Technical log
            </button>
          </div>
        ) : null
      }
      toolbar={embedded ? null : toolbar}
      stackMetrics={!embedded}
      kpis={
        embedded
          ? []
          : [
              { label: 'Total Records', value: listMeta.total },
              { label: 'Current View', value: `${rows.length} on page` },
              { label: 'Date Window', value: `${from} → ${to}` },
            ]
      }
    >
      {embedded ? (
        <OpsReviewSlot totalLabel="Total activities" totalValue={listMeta.total}>
          {filterFields}
        </OpsReviewSlot>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      {view === 'technical' && canSeeTechnical ? (
        <div className="activity-table-card table-wrap">
          <table className="ops-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{formatDateTime(row.at)}</td>
                  <td>{row.actorEmail || row.actorType || '-'}</td>
                  <td><code className="mono-sm">{row.action}</code></td>
                  <td>
                    {row.entityType || '-'}
                    {row.entityId ? ` ${String(row.entityId).slice(-6)}` : ''}
                  </td>
                  <td>
                    <StatusPill
                      status={row.result || '-'}
                      failed={row.result !== 'SUCCESS' && row.result !== 'OK'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !loading ? (
            <div className="activity-log-empty activity-log-empty--hero">
              <span className="activity-log-empty-icon" aria-hidden="true">📋</span>
              <p>No technical log entries recorded for this filter range.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`activity-log${selectedDescribed ? ' activity-log--split' : ''}`}>
          <div className="card card--flush activity-log-list">
            {rows.map((row) => {
              const described = describeActivity(row);
              const open = selectedId === row._id;
              return (
                <button
                  key={row._id}
                  type="button"
                  className={`activity-log-row${open ? ' is-open' : ''}`}
                  onClick={() => setSelectedId(open ? '' : row._id)}
                  aria-expanded={open}
                >
                  <div className="activity-log-row__top">
                    <p className="activity-log-row__title">{described.title}</p>
                    <div className="activity-log-row__badges">
                      <span className="activity-module-pill">{described.moduleLabel}</span>
                      <StatusPill status={described.status} failed={described.failed} />
                    </div>
                  </div>
                  <div className="activity-log-row__meta">
                    <span>{described.employee}</span>
                    <span className="activity-log-row__meta-dot">·</span>
                    <span>{described.where || described.moduleLabel}</span>
                    <span className="activity-log-row__meta-dot">·</span>
                    <span className="activity-log-row__time">{formatDateTime(row.at)}</span>
                  </div>
                </button>
              );
            })}
            {loading && !rows.length ? (
              <div className="activity-log-empty activity-log-empty--hero">
                <span className="activity-log-empty-icon" aria-hidden="true">⏳</span>
                <p>Loading activity stream…</p>
              </div>
            ) : null}
            {!rows.length && !loading ? (
              <div className="activity-log-empty activity-log-empty--hero">
                <span className="activity-log-empty-icon" aria-hidden="true">🔍</span>
                <p>No activity records found matching the selected filter criteria.</p>
              </div>
            ) : null}
          </div>
          {selected && selectedDescribed ? (
            <ActivityDetail
              row={selected}
              described={selectedDescribed}
              canSeeTechnical={canSeeTechnical}
              onClose={() => setSelectedId('')}
            />
          ) : null}
        </div>
      )}

      <PaginationBar
        page={listMeta.page}
        limit={limit}
        total={listMeta.total}
        pages={listMeta.pages}
        loading={loading}
        onPageChange={setPage}
        onLimitChange={(n) => {
          setLimit(n);
          setPage(1);
        }}
      />
    </PageShell>
  );
}
