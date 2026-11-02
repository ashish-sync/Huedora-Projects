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
import { OpsReviewSlot } from '../dashboards/OpsReviewHeader.jsx';
import '../audit/activityLog.css';
import './accessControl.css';

function getInitials(fullName = '', email = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const local = String(email || '').split('@')[0] || '?';
  return local.slice(0, 2).toUpperCase();
}

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
          : 'Directory of colleagues across TYLO ONE: departments, designations, reporting lines, and access status.'
      }
      actions={
        canManage ? (
          <Link className="btn secondary" to={MODULE_PATH.ACCESS_CONTROL}>
            Manage access
          </Link>
        ) : null
      }
      kpis={
        embedded
          ? []
          : [
              { label: 'On the team', value: rows.length },
              { label: 'Active', value: activeCount },
              { label: 'Not signing in', value: rows.length - activeCount },
            ]
      }
      toolbar={
        embedded ? null : (
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
        )
      }
    >
      {embedded ? (
        <OpsReviewSlot totalLabel="On the team" totalValue={filtered.length}>
          <label className="ops-review-header__filter">
            <span>Search</span>
            <input
              className="ops-filter-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, or role"
              aria-label="Search team"
            />
          </label>
          <label className="ops-review-header__filter">
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
        </OpsReviewSlot>
      ) : null}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="org-avatar org-avatar--sm" aria-hidden="true">
                      {getInitials(person.fullName, person.email)}
                    </span>
                    <p className="activity-log-row__title">{person.fullName || person.email}</p>
                  </div>
                  <span className={`activity-log-status${inactive ? ' activity-log-status--bad' : ' activity-log-status--ok'}`}>
                    {personStatusLabel(person)}
                  </span>
                </div>
                <p className="activity-log-row__meta" style={{ paddingLeft: '38px' }}>
                  {personRoleLabel(person)}
                  {person.email ? ` · ${person.email}` : ''}
                </p>
              </button>
            );
          })}
          {loading && !filtered.length ? (
            <div className="activity-log-empty activity-log-empty--hero">
              <span className="activity-log-empty-icon" aria-hidden="true">⏳</span>
              <p>Loading team members…</p>
            </div>
          ) : null}
          {!filtered.length && !loading ? (
            <div className="activity-log-empty activity-log-empty--hero">
              <span className="activity-log-empty-icon" aria-hidden="true">🔍</span>
              <p>No teammates match this filter.</p>
            </div>
          ) : null}
        </div>
        {selected ? (
          <section className="card activity-log-detail" aria-label="Teammate details">
            <div className="activity-log-detail__header">
              <span className={`activity-log-status${selected.isActive === false ? ' activity-log-status--bad' : ' activity-log-status--ok'}`}>
                {personStatusLabel(selected)}
              </span>
              <button type="button" className="btn ghost btn-compact" onClick={() => setSelectedId('')} aria-label="Close teammate details">
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
                <dd>{selected.email || '-'}</dd>
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
