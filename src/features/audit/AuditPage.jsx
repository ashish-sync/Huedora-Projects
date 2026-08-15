import { useEffect, useState, Fragment } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import PageShell from '../../components/ui/PageShell.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import '../notifications/notifications.css';

function buildChangeRows(before, after) {
  if (!before && !after) return [];
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const skip = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'builderForm', 'passwordHash']);
  const rows = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const from = b[key];
    const to = a[key];
    const fs = from == null ? '' : typeof from === 'object' ? JSON.stringify(from) : String(from);
    const ts = to == null ? '' : typeof to === 'object' ? JSON.stringify(to) : String(to);
    if (fs === ts) continue;
    rows.push({ field: key, from: fs || '—', to: ts || '—' });
    if (rows.length >= 40) break;
  }
  return rows;
}

export default function AuditPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ action: '', from: '', to: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [expandedId, setExpandedId] = useState('');
  const canRead = can('audit:read');

  const load = (filters = applied, pageNum = page, pageLimit = limit) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(pageLimit),
    });
    if (filters.action) params.set('action', filters.action);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', `${filters.to}T23:59:59.999`);
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
  }, [page, limit, canRead]);

  if (!canRead) return <p className="error">No audit access</p>;

  const submitFilters = (e) => {
    e?.preventDefault?.();
    if (from && to && from > to) {
      setError('From date must be on or before To date');
      return;
    }
    const next = { action: action.trim(), from, to };
    setApplied(next);
    setPage(1);
    load(next, 1, limit);
  };

  const clearFilters = () => {
    setAction('');
    setFrom('');
    setTo('');
    const next = { action: '', from: '', to: '' };
    setApplied(next);
    setPage(1);
    load(next, 1, limit);
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: 'Audit log' }]}
      title="Audit log"
      description="Activity history with old → new values when recorded."
      toolbar={
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onSubmit={submitFilters}
          onClear={clearFilters}
          submitting={loading}
        >
          <label className="date-range-filter-field" style={{ flex: 1, minWidth: 180 }}>
            <span>Action</span>
            <input
              placeholder="Filter by action code"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 'normal' }}
            />
          </label>
        </DateRangeFilter>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Result</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const changes = buildChangeRows(a.before, a.after);
              const open = expandedId === a._id;
              return (
                <Fragment key={a._id}>
                  <tr>
                    <td>{formatDateTime(a.at)}</td>
                    <td>{a.actorEmail || a.actorType}</td>
                    <td>
                      <code className="mono-sm">{a.action}</code>
                    </td>
                    <td>
                      {a.entityType || '-'} {a.entityId ? String(a.entityId).slice(-6) : ''}
                    </td>
                    <td>{a.result}</td>
                    <td>
                      {changes.length || a.message ? (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          onClick={() => setExpandedId(open ? '' : a._id)}
                        >
                          {open ? 'Hide' : changes.length ? `${changes.length} fields` : 'Details'}
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={6}>
                        {a.message ? <p className="muted" style={{ marginTop: 0 }}>{a.message}</p> : null}
                        {changes.length ? (
                          <ul className="nc-changes">
                            {changes.map((c) => (
                              <li key={c.field}>
                                <span className="nc-change-label">{c.field}</span>
                                <span className="nc-change-values">
                                  <span className="nc-from">{c.from}</span>
                                  <span aria-hidden="true"> → </span>
                                  <span className="nc-to">{c.to}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">No field-level snapshot for this event.</p>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!rows.length && !loading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            No audit rows for this filter.
          </p>
        ) : null}
      </div>
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
