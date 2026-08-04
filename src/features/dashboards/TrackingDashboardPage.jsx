import { useCallback, useEffect, useMemo, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDateRangeLabel } from '../../shared/dateFormat.js';
import { MODULE, ACTION } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import LogisticsHubPage from '../logistics/LogisticsHubPage.jsx';

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'month', label: 'This month' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom' },
];

function rangeForPreset(id) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (id === 'all') return { from: '', to: '' };
  if (id === 'month') return { from: toYmd(startOfMonth(today)), to: toYmd(today) };
  if (id === '30') return { from: toYmd(daysAgo(29)), to: toYmd(today) };
  if (id === '90') return { from: toYmd(daysAgo(89)), to: toYmd(today) };
  return null;
}

function detectPreset(from, to) {
  for (const p of PRESETS) {
    if (p.id === 'custom') continue;
    const r = rangeForPreset(p.id);
    if (r && r.from === from && r.to === to) return p.id;
  }
  if (!from && !to) return 'all';
  return 'custom';
}

function breakdownEntries(summary = {}) {
  const skip = new Set(['total', 'unread', 'read', 'active', 'inactive']);
  const blocks = [];
  for (const [key, value] of Object.entries(summary)) {
    if (skip.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      blocks.push({
        title: key
          .replace(/^by/, '')
          .replace(/([A-Z])/g, ' $1')
          .replace(/^\s+/, '')
          .replace(/^./, (c) => c.toUpperCase()),
        entries: Object.entries(value).sort((a, b) => b[1] - a[1]),
      });
    }
  }
  return blocks;
}

function formatInr(n) {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${value.toLocaleString('en-IN')}`;
  }
}

function formatKpiValue(kpi) {
  if (kpi.format === 'currency') return formatInr(kpi.value);
  return Number(kpi.value || 0).toLocaleString('en-IN');
}

function severityClass(severity) {
  if (severity === 'critical') return 'is-critical';
  if (severity === 'high' || severity === 'warn') return 'is-warn';
  if (severity === 'medium') return 'is-medium';
  if (severity === 'ok') return 'is-ok';
  return '';
}

function severityLabel(severity) {
  if (!severity) return 'Info';
  return String(severity).replace(/_/g, ' ');
}

function relativeUpdated(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleString();
}

function HealthRing({ score = 0, tone = 'ok' }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className={`ops-ring ops-ring--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="ops-ring-svg">
        <circle className="ops-ring-track" cx="50" cy="50" r={r} />
        <circle
          className="ops-ring-progress"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ops-ring-center">
        <span className="ops-health-value">{value}</span>
        <span className="ops-health-label">Score</span>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="ops-overview" aria-busy="true" aria-label="Loading overview">
      <div className="ops-skel ops-skel--hero" />
      <div className="ops-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ops-skel ops-skel--kpi" />
        ))}
      </div>
      <div className="ops-split">
        <div className="ops-skel ops-skel--panel" />
        <div className="ops-skel ops-skel--panel" />
      </div>
    </div>
  );
}

function StatusBars({ title, map = {}, empty = 'No distribution data yet' }) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 0) || 1;
  if (!entries.length) {
    return (
      <section className="ops-panel ops-panel--soft">
        <header className="ops-panel-head">
          <h3>{title}</h3>
        </header>
        <p className="ops-empty-inline">{empty}</p>
      </section>
    );
  }
  return (
    <section className="ops-panel ops-panel--soft">
      <header className="ops-panel-head">
        <h3>{title}</h3>
        <span className="ops-panel-meta">{total.toLocaleString('en-IN')} total</span>
      </header>
      <ul className="ops-bars">
        {entries.map(([label, count]) => (
          <li key={label}>
            <div className="ops-bars-meta">
              <span className="ops-bars-label">{label || '—'}</span>
              <span className="ops-bars-count">
                {count}
                <em>{Math.round((count / total) * 100)}%</em>
              </span>
            </div>
            <div className="ops-bars-track" aria-hidden="true">
              <span style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function insightLine(overview) {
  if (!overview) return '';
  const alerts = overview.alerts?.length || 0;
  const pending = (overview.pending || []).reduce((s, p) => s + (Number(p.count) || 0), 0);
  const breached = overview.repairsSla?.breached || 0;
  if (alerts === 0 && pending === 0 && breached === 0) {
    return 'All queues clear — no critical risks or SLA breaches right now.';
  }
  const parts = [];
  if (pending > 0) parts.push(`${pending} pending action${pending === 1 ? '' : 's'}`);
  if (alerts > 0) parts.push(`${alerts} active alert${alerts === 1 ? '' : 's'}`);
  if (breached > 0) parts.push(`${breached} SLA breach${breached === 1 ? '' : 'es'}`);
  return `Focus now: ${parts.join(' · ')}.`;
}

export default function TrackingDashboardPage() {
  const { can } = useAuth();
  const canDownload = can('dashboards:read') || can('*');

  const [view, setView] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const [modules, setModules] = useState([]);
  const [moduleId, setModuleId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState('month');

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const res = await api('/dashboards/overview');
      setOverview(res.data);
    } catch (err) {
      setOverview(null);
      setOverviewError(err.message);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = rangeForPreset('month');
    if (initial) {
      setFrom(initial.from);
      setTo(initial.to);
    }
    loadOverview();
    api('/dashboards/modules')
      .then((r) => {
        const list = r.data || [];
        setModules(list);
        if (list.length) setModuleId((prev) => prev || list[0].id);
      })
      .catch((e) => setError(e.message));
  }, [loadOverview]);

  const applyPreset = (id) => {
    setPreset(id);
    const r = rangeForPreset(id);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const rangeLabel = useMemo(() => {
    if (!from && !to) return 'All time';
    return formatDateRangeLabel(from, to).replace(' to ', ' → ');
  }, [from, to]);

  const openDrilldown = (nextModuleId) => {
    if (nextModuleId) setModuleId(nextModuleId);
    setView('drilldown');
    setSubmitted(false);
    setData(null);
  };

  const submitReview = async (e) => {
    e?.preventDefault?.();
    if (!moduleId) {
      setError('Select a module to review');
      return;
    }
    setError('');
    setSubmitted(true);
    setView('drilldown');
    if (moduleId === 'logistics') {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ module: moduleId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await api(`/dashboards/module-review?${params}`);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReview = async () => {
    if (!moduleId || moduleId === 'logistics') return;
    setExportBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ module: moduleId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const name = (data?.moduleLabel || moduleId).replace(/\s+/g, '_');
      await downloadExcel(
        `/dashboards/module-review/export?${params}`,
        `TYLO_One_${name}_Review.xlsx`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const clearReview = () => {
    setFrom('');
    setTo('');
    setPreset('all');
    setData(null);
    setSubmitted(false);
    setError('');
  };

  const summaryBlocks = breakdownEntries(data?.summary);
  const kpiItems = [
    { label: 'Records in range', value: data?.summary?.total ?? data?.total ?? 0 },
    data?.summary?.unread != null ? { label: 'Unread', value: data.summary.unread } : null,
    data?.summary?.active != null ? { label: 'Active', value: data.summary.active } : null,
    data?.summary?.inactive != null ? { label: 'Inactive', value: data.summary.inactive } : null,
  ].filter(Boolean);

  const health = overview?.health;
  const fin = overview?.financials;
  const agreements = overview?.agreementsHealth;
  const repairs = overview?.repairsSla;
  const pendingTotal = useMemo(
    () => (overview?.pending || []).reduce((s, p) => s + (Number(p.count) || 0), 0),
    [overview]
  );
  const insight = useMemo(() => insightLine(overview), [overview]);

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.DASHBOARD }]}
      title={MODULE.DASHBOARD}
      description="Executive project health — KPIs, pending work, risks, and financials in one view."
      actions={
        <>
          <div className="ops-view-toggle" role="tablist" aria-label="Dashboard view">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'overview'}
              className={`ops-view-chip${view === 'overview' ? ' is-active' : ''}`}
              onClick={() => setView('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'drilldown'}
              className={`ops-view-chip${view === 'drilldown' ? ' is-active' : ''}`}
              onClick={() => setView('drilldown')}
            >
              Module review
            </button>
          </div>
          {view === 'overview' ? (
            <button
              className="btn secondary"
              type="button"
              disabled={overviewLoading}
              onClick={loadOverview}
            >
              {overviewLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          ) : null}
          {view === 'drilldown' && submitted && moduleId === 'logistics' ? (
            <Link className="btn secondary" to="/movement-one">
              Open Movement One
            </Link>
          ) : null}
          {view === 'drilldown' && data?.linkTo && moduleId !== 'logistics' ? (
            <Link className="btn secondary" to={data.linkTo}>
              Open module
            </Link>
          ) : null}
          {view === 'drilldown' && canDownload && data && moduleId !== 'logistics' ? (
            <button
              className="btn secondary"
              type="button"
              disabled={exportBusy || loading}
              onClick={downloadReview}
            >
              {exportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD_EXCEL}
            </button>
          ) : null}
        </>
      }
      kpis={view === 'drilldown' && data ? kpiItems : undefined}
    >
      {(overviewError || error) && view === 'overview' ? (
        <FeedbackBanner variant="error">{overviewError || error}</FeedbackBanner>
      ) : null}
      {error && view === 'drilldown' ? (
        <FeedbackBanner variant="error">{error}</FeedbackBanner>
      ) : null}

      {view === 'overview' ? (
        <div className="ops-overview">
          {overviewLoading && !overview ? <OverviewSkeleton /> : null}

          {overview ? (
            <>
              <section className={`ops-hero ops-hero--${health?.tone || 'ok'}`}>
                <div className="ops-hero-main">
                  <HealthRing score={health?.score} tone={health?.tone || 'ok'} />
                  <div className="ops-hero-copy">
                    <div className="ops-hero-eyebrow">
                      <span className={`ops-tone-pill ops-tone-pill--${health?.tone || 'ok'}`}>
                        {health?.label || 'Project health'}
                      </span>
                      <span className="ops-hero-updated" title={new Date(overview.generatedAt).toLocaleString()}>
                        Updated {relativeUpdated(overview.generatedAt)}
                      </span>
                    </div>
                    <h2>Complete project health</h2>
                    <p className="ops-hero-insight">{insight}</p>
                    <div className="ops-hero-chips" aria-label="Attention summary">
                      <span className="ops-chip">
                        <strong>{overview.alerts?.length || 0}</strong> alerts
                      </span>
                      <span className="ops-chip">
                        <strong>{pendingTotal}</strong> pending
                      </span>
                      <span className="ops-chip">
                        <strong>{repairs?.breached || 0}</strong> SLA breaches
                      </span>
                    </div>
                  </div>
                </div>
                <aside className="ops-hero-aside" aria-label="Quick signals">
                  <div className="ops-signal">
                    <span className="ops-signal-label">Open repairs</span>
                    <strong>{repairs?.openCount || 0}</strong>
                  </div>
                  <div className="ops-signal">
                    <span className="ops-signal-label">Agreements expiring</span>
                    <strong>{agreements?.expiring || 0}</strong>
                  </div>
                  <div className="ops-signal">
                    <span className="ops-signal-label">Expense open</span>
                    <strong>{fin?.expenseOpen || 0}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-compact ops-hero-cta"
                    onClick={() => setView('drilldown')}
                  >
                    Module review
                  </button>
                </aside>
              </section>

              <section className="ops-section" aria-labelledby="ops-kpi-heading">
                <div className="ops-section-head">
                  <div>
                    <h3 id="ops-kpi-heading">Critical KPIs</h3>
                    <p>Live cross-module metrics — open any tile to act.</p>
                  </div>
                </div>
                <div className="ops-kpi-grid" aria-label="Critical KPIs">
                  {(overview.kpis || []).map((kpi) => (
                    <Link
                      key={kpi.id}
                      to={kpi.href || '#'}
                      className={`ops-kpi ${severityClass(kpi.tone)}`}
                    >
                      <span className="ops-kpi-label">{kpi.label}</span>
                      <span className="ops-kpi-value">{formatKpiValue(kpi)}</span>
                      <span className="ops-kpi-go">Open →</span>
                    </Link>
                  ))}
                </div>
              </section>

              <div className="ops-split">
                <section className="ops-panel" aria-labelledby="ops-pending-heading">
                  <header className="ops-panel-head">
                    <div>
                      <h3 id="ops-pending-heading">Pending actions</h3>
                      <p className="ops-panel-sub">Queues that block progress</p>
                    </div>
                    <span className="ops-count-badge">{pendingTotal}</span>
                  </header>
                  {!overview.pending?.length ? (
                    <div className="ops-empty">
                      <strong>All clear</strong>
                      <p>No open approval or finance queues.</p>
                    </div>
                  ) : (
                    <ul className="ops-action-list">
                      {overview.pending.map((item) => (
                        <li key={item.id} className={severityClass(item.severity)}>
                          <div className="ops-item-body">
                            <strong>{item.label}</strong>
                            <span className="ops-item-meta">
                              <em>{item.count}</em> open
                            </span>
                          </div>
                          <div className="ops-action-links">
                            <Link className="btn secondary btn-compact" to={item.href}>
                              Open
                            </Link>
                            {item.module ? (
                              <button
                                type="button"
                                className="btn ghost btn-compact"
                                onClick={() => openDrilldown(item.module)}
                              >
                                Review
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="ops-panel" aria-labelledby="ops-alerts-heading">
                  <header className="ops-panel-head">
                    <div>
                      <h3 id="ops-alerts-heading">Risks &amp; alerts</h3>
                      <p className="ops-panel-sub">Priority first</p>
                    </div>
                    <span className="ops-count-badge ops-count-badge--warn">
                      {overview.alerts?.length || 0}
                    </span>
                  </header>
                  {!overview.alerts?.length ? (
                    <div className="ops-empty">
                      <strong>No active risks</strong>
                      <p>No critical or high-severity signals right now.</p>
                    </div>
                  ) : (
                    <ul className="ops-alert-list">
                      {overview.alerts.map((alert) => (
                        <li key={alert.id} className={severityClass(alert.severity)}>
                          <div className="ops-item-body">
                            <span className={`ops-severity ops-severity--${alert.severity}`}>
                              {severityLabel(alert.severity)}
                            </span>
                            <strong>{alert.label}</strong>
                            <p>{alert.detail}</p>
                          </div>
                          <div className="ops-action-links">
                            <Link className="btn secondary btn-compact" to={alert.href}>
                              Review
                            </Link>
                            {alert.module ? (
                              <button
                                type="button"
                                className="btn ghost btn-compact"
                                onClick={() => openDrilldown(alert.module)}
                              >
                                Drill down
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section className="ops-section" aria-labelledby="ops-finance-heading">
                <div className="ops-section-head">
                  <div>
                    <h3 id="ops-finance-heading">Financial snapshot</h3>
                    <p>Commercial documents, expenses, and agreement exposure.</p>
                  </div>
                  <Link className="btn secondary btn-compact" to="/finance-one">
                    Finance One
                  </Link>
                </div>
                <div className="ops-finance-grid">
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Expense total</span>
                    <strong>{formatInr(fin?.expenseTotal)}</strong>
                    <span className="ops-tile-meta">
                      {fin?.expenseCount || 0} expenses · {fin?.expenseOpen || 0} open
                    </span>
                  </div>
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Vendor invoices</span>
                    <strong>{formatInr(fin?.invoiceTotal)}</strong>
                    <span className="ops-tile-meta">
                      {fin?.invoiceCount || 0} invoices · {fin?.invoiceOpen || 0} open
                    </span>
                  </div>
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Client invoices</span>
                    <strong>{formatInr(fin?.clientInvoiceTotal)}</strong>
                    <span className="ops-tile-meta">
                      {fin?.clientInvoiceCount || 0} docs · {fin?.commercialDraft || 0} in progress
                    </span>
                  </div>
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Proformas</span>
                    <strong>{fin?.proformaCount || 0}</strong>
                    <span className="ops-tile-meta">{fin?.proformaDraft || 0} draft</span>
                  </div>
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Purchase orders</span>
                    <strong>{fin?.purchaseOrderCount || 0}</strong>
                    <span className="ops-tile-meta">{fin?.purchaseOrderDraft || 0} draft</span>
                  </div>
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Agreements active</span>
                    <strong>{agreements?.active || 0}</strong>
                    <span className="ops-tile-meta">
                      {agreements?.expiring || 0} expiring · {agreements?.expired || 0} expired
                    </span>
                  </div>
                  <div className="ops-finance-tile">
                    <span className="ops-kpi-label">Repair SLA</span>
                    <strong>
                      {repairs?.openCount || 0} <span className="ops-tile-unit">open</span>
                    </strong>
                    <span className="ops-tile-meta">{repairs?.breached || 0} breached</span>
                  </div>
                </div>
              </section>

              <section className="ops-section" aria-labelledby="ops-modules-heading">
                <div className="ops-section-head">
                  <div>
                    <h3 id="ops-modules-heading">Module portfolio</h3>
                    <p>Status by module — open to work, or drill into a dated review.</p>
                  </div>
                </div>
                <div className="ops-module-grid">
                  {(overview.modules || []).map((mod) => (
                    <article key={mod.id} className={`ops-module ${severityClass(mod.status)}`}>
                      <div className="ops-module-top">
                        <h4>{mod.label}</h4>
                        <span className={`ops-status-pill ops-status-pill--${mod.status || 'ok'}`}>
                          {mod.status === 'critical'
                            ? 'Critical'
                            : mod.status === 'warn'
                              ? 'Watch'
                              : 'Healthy'}
                        </span>
                      </div>
                      <div className="ops-module-metrics">
                        <div>
                          <strong>{Number(mod.primary || 0).toLocaleString('en-IN')}</strong>
                          <span>{mod.primaryLabel}</span>
                        </div>
                        {mod.secondaryLabel ? (
                          <div>
                            <strong>{Number(mod.secondary || 0).toLocaleString('en-IN')}</strong>
                            <span>{mod.secondaryLabel}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="ops-action-links ops-module-actions">
                        <Link className="btn secondary btn-compact" to={mod.href}>
                          Open
                        </Link>
                        <button
                          type="button"
                          className="btn ghost btn-compact"
                          onClick={() => openDrilldown(mod.id)}
                        >
                          Review
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="ops-section" aria-labelledby="ops-dist-heading">
                <div className="ops-section-head">
                  <div>
                    <h3 id="ops-dist-heading">Operational distribution</h3>
                    <p>Status mix across assets, requests, verification, and camps.</p>
                  </div>
                </div>
                <div className="ops-breakdown-grid">
                  <StatusBars title="Assets by status" map={overview.breakdowns?.assetsByStatus} />
                  <StatusBars
                    title="Requests by status"
                    map={overview.breakdowns?.requestsByStatus}
                  />
                  <StatusBars
                    title="Verifications by status"
                    map={overview.breakdowns?.verificationByStatus}
                  />
                  <StatusBars title="Camps by status" map={overview.breakdowns?.campsByStatus} />
                </div>
              </section>
            </>
          ) : null}
        </div>
      ) : null}

      {view === 'drilldown' ? (
        <>
          <div className="card track-range ops-review-filters" aria-label="Module review filters">
        <div className="track-range-presets" role="group" aria-label="Quick ranges">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`track-range-chip${preset === p.id ? ' is-active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <DateRangeFilter
          className="date-range-filter--panel"
          from={from}
          to={to}
          onFromChange={(next) => {
            setFrom(next);
            setPreset(detectPreset(next, to));
          }}
          onToChange={(next) => {
            setTo(next);
            setPreset(detectPreset(from, next));
          }}
          onSubmit={submitReview}
          onClear={clearReview}
          submitting={loading}
          disabled={!moduleId}
          hint={`Review uses each module's activity date (${data?.dateFieldLabel || 'created / transaction date'}). Current range: ${rangeLabel}.`}
        >
          <label className="date-range-filter-field module-review-module">
            <span>Module</span>
            <AdaptiveSelect
              required
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              aria-label="Module"
            >
              <option value="">Select module</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </AdaptiveSelect>
          </label>
        </DateRangeFilter>
      </div>

      {!submitted && !data ? (
        <EmptyState
          title="Choose a module and date range"
              description="Pick what you want to review, set From and To, then submit — or return to Overview for the full project picture."
              action={
                <button type="button" className="btn secondary" onClick={() => setView('overview')}>
                  Back to overview
                </button>
              }
        />
      ) : null}

          {loading && !data && moduleId !== 'logistics' ? (
            <p className="muted">Loading review…</p>
          ) : null}

      {submitted && moduleId === 'logistics' ? (
        <div className="module-review-logistics">
          <div className="module-review-logistics-head">
            <div>
              <h2 className="module-review-logistics-title">Movement One dashboard</h2>
              <p className="muted" style={{ margin: 0 }}>
                Live stock movement for {rangeLabel}. Open Movement One for goods receipt and
                goods issue actions.
              </p>
            </div>
                <Link className="btn secondary btn-compact" to="/movement-one">
              Open Movement One
            </Link>
          </div>
          <LogisticsHubPage embedded initialFrom={from} initialTo={to} />
        </div>
      ) : null}

      {data && moduleId !== 'logistics' ? (
        <div className="track-sections module-review-results">
          {summaryBlocks.map((block) => (
            <section className="card track-panel" key={block.title}>
              <div className="track-panel-head">
                <div>
                  <h2>{block.title}</h2>
                  <p className="muted">
                    {data.moduleLabel} · {rangeLabel}
                  </p>
                </div>
              </div>
              <div className="track-table-wrap">
                <table className="track-table">
                  <thead>
                    <tr>
                      <th>Value</th>
                      <th className="num">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.entries.map(([label, count]) => (
                      <tr key={label}>
                        <td>
                          <span className="badge tone-neutral">{label}</span>
                        </td>
                        <td className="num mono-sm">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section className="card track-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="track-panel-head">
              <div>
                <h2>{data.moduleLabel} records</h2>
                <p className="muted">
                  Showing {data.rows?.length || 0}
                  {data.truncated ? ` of ${data.total}` : ''} in range
                  {data.dateFieldLabel ? ` · sorted by ${data.dateFieldLabel}` : ''}
                </p>
              </div>
              {data.linkTo ? (
                <Link className="btn secondary btn-compact" to={data.linkTo}>
                  Open {data.moduleLabel}
                </Link>
              ) : null}
            </div>
                <div
                  className="track-table-wrap card table-wrap"
                  style={{ boxShadow: 'none', border: 0 }}
                >
              <table className="track-table">
                <thead>
                  <tr>
                    {(data.columns || []).map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.rows || []).map((row) => (
                    <tr key={row.id}>
                      {(data.columns || []).map((col) => (
                            <td
                              key={col.key}
                              className={col.key === 'when' ? 'mono-sm muted' : undefined}
                            >
                          {row[col.key] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.rows?.length ? (
                <p className="muted" style={{ padding: '1rem' }}>
                  No records found for this module in the selected date range.
                </p>
              ) : null}
            </div>
          </section>
        </div>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
