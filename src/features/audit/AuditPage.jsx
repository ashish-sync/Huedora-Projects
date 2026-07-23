import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import PageShell from '../../components/ui/PageShell.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';

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

  if (!can('audit:read')) return <p className="error">No audit access</p>;

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when page/limit change
  }, [page, limit]);

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
      description="Activity history for agreements, assets, and administration."
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
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id}>
                <td>{formatDateTime(a.at)}</td>
                <td>{a.actorEmail || a.actorType}</td>
                <td>
                  <code className="mono-sm">{a.action}</code>
                </td>
                <td>
                  {a.entityType || '-'} {a.entityId ? String(a.entityId).slice(-6) : ''}
                </td>
                <td>{a.result}</td>
              </tr>
            ))}
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
