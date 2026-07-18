import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';

export default function AuditPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ action: '', from: '', to: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!can('audit:read')) return <p className="error">No audit access</p>;

  const load = (filters = applied) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (filters.action) params.set('action', filters.action);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', `${filters.to}T23:59:59.999`);
    const q = params.toString();
    api(`/audit-logs${q ? `?${q}` : ''}`)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const submitFilters = (e) => {
    e?.preventDefault?.();
    if (from && to && from > to) {
      setError('From date must be on or before To date');
      return;
    }
    const next = { action: action.trim(), from, to };
    setApplied(next);
    load(next);
  };

  const clearFilters = () => {
    setAction('');
    setFrom('');
    setTo('');
    const next = { action: '', from: '', to: '' };
    setApplied(next);
    load(next);
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: 'Audit log' }]}
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
      <div className="card table-wrap">
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
                <td>{new Date(a.at).toLocaleString()}</td>
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
    </PageShell>
  );
}
