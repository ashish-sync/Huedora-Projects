import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import { MODULE_PATH } from '../../shared/moduleRoutes.js';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { personRoleLabel, personStatusLabel } from '../dashboards/opsReviewCatalog.js';
import '../audit/activityLog.css';

export default function UsersPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const canView = can('users:read') || can('users:write') || can('*');
  const canManage = can('users:write') || can('*');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    api('/users?limit=200')
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [canView]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((person) => {
      if (status === 'active' && person.isActive === false) return false;
      if (status === 'inactive' && person.isActive !== false) return false;
      if (!q) return true;
      const hay = [
        person.fullName,
        person.email,
        person.designation,
        person.username,
        person.reportingManager?.fullName,
        ...(person.roles || []).map((r) => r.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, status]);

  const selected = filtered.find((p) => String(p.id || p._id) === String(selectedId));
  const activeCount = rows.filter((p) => p.isActive !== false).length;

  if (!canView) {
    return <p className="error">You do not have access to the team list.</p>;
  }

  return (
    <PageShell
      bare={embedded}
      breadcrumbs={embedded ? [] : [{ to: '/', label: MODULE.HOME }, { label: MODULE.TEAM }]}
      title={embedded ? '' : MODULE.TEAM}
      description={
        embedded
          ? ''
          : 'Who is on Tylo One, whether they can sign in, and what they look after.'
      }
      actions={
        canManage ? (
          <Link className="btn secondary" to={MODULE_PATH.ACCESS_CONTROL}>
            Manage access
          </Link>
        ) : null
      }
      kpis={[
        { label: 'On the team', value: rows.length },
        { label: 'Active', value: activeCount },
        { label: 'Not signing in', value: rows.length - activeCount },
      ]}
      toolbar={
        <form className="date-range-filter" aria-label="Team filters" onSubmit={(e) => e.preventDefault()}>
          <div className="date-range-filter-fields">
            <label className="date-range-filter-field ops-filter-field--grow">
              <span>Search</span>
              <input
                className="ops-filter-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, or role"
                aria-label="Search team"
              />
            </label>
            <label className="date-range-filter-field ops-filter-field--md">
              <span>Status</span>
              <AdaptiveSelect
                aria-label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Everyone</option>
                <option value="active">Active</option>
                <option value="inactive">Not signing in</option>
              </AdaptiveSelect>
            </label>
            {query || status ? (
              <div className="date-range-filter-actions">
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setStatus('');
                    setSelectedId('');
                  }}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        </form>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      <div className={`activity-log${selected ? ' activity-log--split' : ''}`}>
        <div className="card card--flush activity-log-list">
          {filtered.map((person) => {
            const id = String(person.id || person._id);
            const open = selectedId === id;
            const inactive = person.isActive === false;
            return (
              <button
                key={id}
                type="button"
                className={`activity-log-row${open ? ' is-open' : ''}`}
                onClick={() => setSelectedId(open ? '' : id)}
                aria-expanded={open}
              >
                <div className="activity-log-row__top">
                  <p className="activity-log-row__title">{person.fullName || person.email}</p>
                  <span className={`activity-log-status${inactive ? ' activity-log-status--bad' : ' activity-log-status--ok'}`}>
                    {personStatusLabel(person)}
                  </span>
                </div>
                <p className="activity-log-row__meta">
                  {personRoleLabel(person)}
                  {person.email ? ` · ${person.email}` : ''}
                </p>
              </button>
            );
          })}
          {loading && !filtered.length ? (
            <p className="muted activity-log-empty">Loading the team…</p>
          ) : null}
          {!filtered.length && !loading ? (
            <p className="muted activity-log-empty">No people match this filter.</p>
          ) : null}
        </div>
        {selected ? (
          <section className="card activity-log-detail" aria-label="Teammate details">
            <div className="activity-log-row__top">
              <span className={`activity-log-status${selected.isActive === false ? ' activity-log-status--bad' : ' activity-log-status--ok'}`}>
                {personStatusLabel(selected)}
              </span>
              <button type="button" className="btn ghost btn-compact" onClick={() => setSelectedId('')}>
                Close
              </button>
            </div>
            <h3>{selected.fullName || selected.email}</h3>
            <p className="activity-log-detail__summary">
              {personRoleLabel(selected)}
              {selected.reportingManager?.fullName
                ? ` · reports to ${selected.reportingManager.fullName}`
                : ''}
            </p>
            <dl className="activity-log-facts">
              <div>
                <dt>Email</dt>
                <dd>{selected.email || '—'}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{personRoleLabel(selected)}</dd>
              </div>
              {selected.reportingManager?.fullName ? (
                <div>
                  <dt>Reports to</dt>
                  <dd>{selected.reportingManager.fullName}</dd>
                </div>
              ) : null}
              <div>
                <dt>Last signed in</dt>
                <dd>{selected.lastLoginAt ? formatDateTime(selected.lastLoginAt) : 'Not yet'}</dd>
              </div>
            </dl>
            {canManage ? (
              <Link className="btn secondary btn-compact" to={MODULE_PATH.ACCESS_CONTROL}>
                Change access
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
