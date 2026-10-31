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
import './activityLog.css';
import '../notifications/notifications.css';

function StatusPill({ status, failed }) {
  return (
    <span className={`activity-log-status${failed ? ' activity-log-status--bad' : ' activity-log-status--ok'}`}>
      {status}
    </span>
  );
}

function ActivityDetail({ row, described, canSeeTechnical, onClose }) {
  return (
    <section className="card activity-log-detail" aria-label="Activity details">
      <div className="activity-log-row__top">
        <StatusPill status={described.status} failed={described.failed} />
        {onClose ? (
          <button type="button" className="btn ghost btn-compact" onClick={onClose}>
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
        <>
          <p className="section-label">What changed</p>
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
        </>
      ) : row.message ? (
        <p className="muted">{row.message}</p>
      ) : (
        <p className="muted">No further business details were stored for this activity.</p>
      )}
      {canSeeTechnical ? (
        <details className="activity-log-tech">
          <summary>Technical details</summary>
          <dl className="activity-log-facts">
            <div>
              <dt>Event code</dt>
              <dd><code className="mono-sm">{row.action || '—'}</code></dd>
            </div>
            <div>
              <dt>Record type</dt>
              <dd><code className="mono-sm">{row.entityType || '—'}</code></dd>
            </div>
            <div>
              <dt>Record id</dt>
              <dd><code className="mono-sm">{row.entityId ? String(row.entityId) : '—'}</code></dd>
            </div>
            {row.ip ? (
              <div>
                <dt>IP</dt>
                <dd><code className="mono-sm">{row.ip}</code></dd>
              </div>
            ) : null}
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
  const [from, setFrom] = useState(initialFrom || '');
  const [to, setTo] = useState(initialTo || '');
  const [applied, setApplied] = useState({
    module: '',
    employee: '',
    status: '',
    from: initialFrom || '',
    to: initialTo || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    setFrom(initialFrom || '');
    setTo(initialTo || '');
    setApplied((prev) => ({
      ...prev,
      from: initialFrom || '',
      to: initialTo || '',
    }));
  }, [initialFrom, initialTo]);

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
    const nextFrom = embedded ? initialFrom || '' : '';
    const nextTo = embedded ? initialTo || '' : '';
    setFrom(nextFrom);
    setTo(nextTo);
    setApplied({ module: '', employee: '', status: '', from: nextFrom, to: nextTo });
    setPage(1);
    setSelectedId('');
  };

  const selected = rows.find((row) => row._id === selectedId);
  const selectedDescribed = selected ? describeActivity(selected) : null;

  const toolbar = (
    <DateRangeFilter
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      onSubmit={submitFilters}
      onClear={clearFilters}
      submitting={loading}
      hideDates={embedded}
    >
      <label className="date-range-filter-field ops-filter-field--md">
        <span>Module</span>
        <AdaptiveSelect
          aria-label="Module"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
        >
          <option value="">All modules</option>
          {ACTIVITY_MODULES.map((mod) => (
            <option key={mod.id} value={mod.id}>{mod.label}</option>
          ))}
        </AdaptiveSelect>
      </label>
      <label className="date-range-filter-field ops-filter-field--grow">
        <span>Employee</span>
        <input
          className="ops-filter-input"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          placeholder="Name or email"
          aria-label="Employee"
        />
      </label>
      <label className="date-range-filter-field ops-filter-field--sm">
        <span>Status</span>
        <AdaptiveSelect
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {ACTIVITY_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </AdaptiveSelect>
      </label>
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
          : 'What happened across Tylo One — who did what, where, and how it turned out.'
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
      toolbar={toolbar}
    >
      {error ? <p className="error">{error}</p> : null}

      {view === 'technical' && canSeeTechnical ? (
        <div className="card card--flush table-wrap">
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
                  <td>{row.actorEmail || row.actorType || '—'}</td>
                  <td><code className="mono-sm">{row.action}</code></td>
                  <td>
                    {row.entityType || '—'}
                    {row.entityId ? ` ${String(row.entityId).slice(-6)}` : ''}
                  </td>
                  <td>{row.result || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !loading ? (
            <p className="muted activity-log-empty">No technical rows for this filter.</p>
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
                    <StatusPill status={described.status} failed={described.failed} />
                  </div>
                  <p className="activity-log-row__meta">
                    {described.employee}
                    {' · '}
                    {described.where || described.moduleLabel}
                    {' · '}
                    {formatDateTime(row.at)}
                  </p>
                </button>
              );
            })}
            {loading && !rows.length ? (
              <p className="muted activity-log-empty">Loading activity…</p>
            ) : null}
            {!rows.length && !loading ? (
              <p className="muted activity-log-empty">No activity for this filter.</p>
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
