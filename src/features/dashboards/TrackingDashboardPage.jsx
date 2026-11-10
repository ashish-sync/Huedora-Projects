import { MODULE, ACTION } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import OpsReviewHeader, { OpsReviewSlotProvider } from './OpsReviewHeader.jsx';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDateRangeLabel } from '../../shared/dateFormat.js';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getQuickDateRange } from '../camps/utils/dateRange.js';
import { buildOpsReviewReturnTo, withOpsReviewReturnTo } from './opsReviewReturn.js';
import OpsOverviewBoard from './OpsOverviewBoard.jsx';

const LogisticsHubPage = lazy(() => import('../logistics/LogisticsHubPage.jsx'));
const CampOperationsBoard = lazy(() => import('../camps/components/CampOperationsBoard.jsx'));
const AuditPage = lazy(() => import('../audit/AuditPage.jsx'));
const UsersPage = lazy(() => import('../users/UsersPage.jsx'));
const NotificationsPage = lazy(() => import('../notifications/NotificationsPage.jsx'));
const ImportsPage = lazy(() => import('../imports/ImportsPage.jsx'));

const EMBEDDED_REVIEW = new Set(['logistics', 'camps', 'audit', 'users', 'notifications', 'imports']);

const REVIEW_TOTAL_LABELS = {
  assets: 'Total assets',
  agreements: 'Total documents',
  contacts: 'Total contacts',
  verifications: 'Total verifications',
  camps: 'Total camps',
  'asset-requests': 'Total requests',
  logistics: 'Total movements',
  finance: 'Total records',
  'master-data': 'Total records',
  movements: 'Total issuances',
  imports: 'Total uploads',
  notifications: 'Total updates',
  audit: 'Total activities',
  users: 'On the team',
};

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

const CAMP_DAY_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'tomorrow', label: 'Tomorrow' },
];

function rangeForPreset(id) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (id === 'all') return { from: '', to: '' };
  if (id === 'month') return { from: toYmd(startOfMonth(today)), to: toYmd(today) };
  if (id === '30') return { from: toYmd(daysAgo(29)), to: toYmd(today) };
  if (id === '90') return { from: toYmd(daysAgo(89)), to: toYmd(today) };
  if (id === 'today' || id === 'yesterday' || id === 'tomorrow') {
    const range = getQuickDateRange(id);
    return { from: range.dateFrom, to: range.dateTo };
  }
  return null;
}

function detectPreset(from, to) {
  for (const p of [...CAMP_DAY_PRESETS, ...PRESETS]) {
    if (p.id === 'custom') continue;
    const r = rangeForPreset(p.id);
    if (r && r.from === from && r.to === to) return p.id;
  }
  if (!from && !to) return 'all';
  return 'custom';
}

function initialRangeFromSearch(searchParams) {
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const preset = searchParams.get('preset') || '';
  if (from || to) {
    return { from, to, preset: preset || detectPreset(from, to) };
  }
  if (preset) {
    const ranged = rangeForPreset(preset);
    if (ranged) return { from: ranged.from, to: ranged.to, preset };
    return { from: '', to: '', preset };
  }
  const month = rangeForPreset('month');
  return { from: month.from, to: month.to, preset: 'month' };
}

function applyRangeToParams(params, nextFrom, nextTo, nextPreset) {
  if (nextFrom) params.set('from', nextFrom);
  else params.delete('from');
  if (nextTo) params.set('to', nextTo);
  else params.delete('to');
  if (nextPreset) params.set('preset', nextPreset);
  else params.delete('preset');
  return params;
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

export default function TrackingDashboardPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canDownload = can('dashboards:read') || can('*');
  const canSeeCampOps = can('camps:read') || can('camps:request') || can('camps:approve') || can('*');
  const showAssetValue = can('assets:view-value') || can('*');

  const moduleParam = searchParams.get('module');
  const tabParam = searchParams.get('tab');
  const wantsCampReview =
    canSeeCampOps
    && (moduleParam === 'camps' || tabParam === 'campOne' || tabParam === 'drilldown' && moduleParam === 'camps');

  const initialView =
    tabParam === 'drilldown' || tabParam === 'campOne' || moduleParam
      ? 'drilldown'
      : 'overview';
  const [view, setView] = useState(initialView);

  const [modules, setModules] = useState([]);
  const [moduleId, setModuleId] = useState(wantsCampReview ? 'camps' : '');
  const bootRange = initialRangeFromSearch(searchParams);
  const [from, setFrom] = useState(bootRange.from);
  const [to, setTo] = useState(bootRange.to);
  const [preset, setPreset] = useState(bootRange.preset);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(wantsCampReview));
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  const isEmbeddedModule = EMBEDDED_REVIEW.has(moduleId);

  const loadOverviewKpis = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const q = params.toString();
      const res = await api(`/dashboards/ops-overview-kpis${q ? `?${q}` : ''}`);
      setOverviewData(res.data || null);
    } catch (err) {
      setOverviewData(null);
      setOverviewError(err.message || 'Unable to load overview KPIs.');
    } finally {
      setOverviewLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    api('/dashboards/modules')
      .then((r) => {
        const list = r.data || [];
        setModules(list);
        if (list.length) {
          setModuleId((prev) => {
            if (prev && list.some((m) => m.id === prev)) return prev;
            if (wantsCampReview && list.some((m) => m.id === 'camps')) return 'camps';
            return list[0].id;
          });
        }
      })
      .catch((e) => setError(e.message));
  }, [wantsCampReview]);

  useEffect(() => {
    if (view !== 'overview') return undefined;
    loadOverviewKpis();
    return undefined;
  }, [view, loadOverviewKpis]);

  useEffect(() => {
    if (!wantsCampReview) return;
    setView('drilldown');
    setModuleId('camps');
    setSubmitted(true);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const alreadyReview = params.get('tab') === 'drilldown' && params.get('module') === 'camps';
      applyRangeToParams(params, from, to, preset);
      if (alreadyReview
        && (params.get('from') || '') === (from || '')
        && (params.get('to') || '') === (to || '')
        && (params.get('preset') || '') === (preset || '')) {
        return prev;
      }
      params.set('tab', 'drilldown');
      params.set('module', 'camps');
      return params;
    }, { replace: true });
  }, [wantsCampReview, from, to, preset, setSearchParams]);

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

  useEffect(() => {
    setSearchParams((prev) => {
      if (
        (prev.get('from') || '') === (from || '')
        && (prev.get('to') || '') === (to || '')
        && (prev.get('preset') || '') === (preset || '')
      ) {
        return prev;
      }
      const params = new URLSearchParams(prev);
      applyRangeToParams(params, from, to, preset);
      return params;
    }, { replace: true });
  }, [from, to, preset, setSearchParams]);

  const setDashboardView = (next) => {
    setView(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'drilldown') {
        params.set('tab', 'drilldown');
        if (moduleId) params.set('module', moduleId);
        applyRangeToParams(params, from, to, preset);
      } else {
        params.set('tab', 'overview');
        params.delete('module');
        applyRangeToParams(params, from, to, preset);
      }
      return params;
    }, { replace: true });
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
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'drilldown');
      params.set('module', moduleId);
      applyRangeToParams(params, from, to, preset);
      return params;
    }, { replace: true });
    if (EMBEDDED_REVIEW.has(moduleId)) {
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
    if (!moduleId || isEmbeddedModule) return;
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
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      applyRangeToParams(params, '', '', 'all');
      params.delete('client');
      params.delete('campaign');
      params.delete('campaignType');
      params.delete('assignedUser');
      return params;
    }, { replace: true });
  };

  const campReviewReturnTo = buildOpsReviewReturnTo({
    from,
    to,
    preset,
    client: searchParams.get('client') || '',
    campaign: searchParams.get('campaign') || '',
    campaignType: searchParams.get('campaignType') || '',
    assignedUser: searchParams.get('assignedUser') || '',
  });
  const openCampOneHref = `/camp-one/manage?${withOpsReviewReturnTo(new URLSearchParams(), campReviewReturnTo)}`;

  const summaryBlocks = breakdownEntries(data?.summary);

  const reviewPresets = useMemo(() => [...CAMP_DAY_PRESETS, ...PRESETS], []);
  const fallbackTotal = useMemo(() => {
    if (!submitted || isEmbeddedModule) return null;
    if (!data) return null;
    return {
      label: REVIEW_TOTAL_LABELS[moduleId] || 'Total records',
      value: data.summary?.total ?? data.total ?? data.rows?.length ?? 0,
      href: data.linkTo || '',
    };
  }, [submitted, isEmbeddedModule, data, moduleId]);

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.DASHBOARD }]}
      title={MODULE.DASHBOARD}
      description="KPI architecture across Asset, Verification, Camp, Master, Movement, and Finance One."
      actions={
        <>
          <div className="ops-view-toggle" role="tablist" aria-label="Dashboard view">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'overview'}
              className={`ops-view-chip${view === 'overview' ? ' is-active' : ''}`}
              onClick={() => setDashboardView('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'drilldown'}
              className={`ops-view-chip${view === 'drilldown' ? ' is-active' : ''}`}
              onClick={() => setDashboardView('drilldown')}
            >
              Module review
            </button>
          </div>
          {view === 'drilldown' && submitted && moduleId === 'logistics' ? (
            <Link className="btn secondary" to="/movement-one">
              Open Movement One
            </Link>
          ) : null}
          {view === 'drilldown' && submitted && moduleId === 'camps' ? (
            <Link className="btn secondary" to={openCampOneHref} state={{ returnTo: campReviewReturnTo }}>
              Open Camp One
            </Link>
          ) : null}
          {view === 'drilldown' && submitted && moduleId === 'audit' ? (
            <Link className="btn secondary" to="/audit">
              Open Activity Log
            </Link>
          ) : null}
          {view === 'drilldown' && submitted && moduleId === 'users' ? (
            <Link className="btn secondary" to="/access-control">
              Manage access
            </Link>
          ) : null}
          {view === 'drilldown' && submitted && moduleId === 'notifications' ? (
            <Link className="btn secondary" to="/notifications">
              Open inbox
            </Link>
          ) : null}
          {view === 'drilldown' && submitted && moduleId === 'imports' ? (
            <Link className="btn secondary" to="/imports">
              Open uploads
            </Link>
          ) : null}
          {view === 'drilldown' && data?.linkTo && !isEmbeddedModule ? (
            <Link className="btn secondary" to={data.linkTo}>
              Open module
            </Link>
          ) : null}
          {view === 'drilldown' && canDownload && data && !isEmbeddedModule ? (
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
    >
      {error && view === 'drilldown' ? (
        <FeedbackBanner variant="error">{error}</FeedbackBanner>
      ) : null}

      {view === 'overview' ? (
        <OpsOverviewBoard
          data={overviewData}
          loading={overviewLoading}
          error={overviewError}
          showValue={showAssetValue}
          from={from}
          to={to}
          preset={preset}
          presets={reviewPresets}
          onFrom={(next) => {
            setFrom(next);
            setPreset(detectPreset(next, to));
          }}
          onTo={(next) => {
            setTo(next);
            setPreset(detectPreset(from, next));
          }}
          onPreset={applyPreset}
          onRefresh={loadOverviewKpis}
        />
      ) : null}

      {view === 'drilldown' ? (
        <OpsReviewSlotProvider>
          <OpsReviewHeader
            presets={reviewPresets}
            preset={preset}
            onPreset={applyPreset}
          from={from}
          to={to}
            onFrom={(next) => {
            setFrom(next);
            setPreset(detectPreset(next, to));
          }}
            onTo={(next) => {
            setTo(next);
            setPreset(detectPreset(from, next));
          }}
            moduleId={moduleId}
            modules={modules}
            onModule={(next) => {
                setModuleId(next);
                setData(null);
                setError('');
              if (EMBEDDED_REVIEW.has(next)) {
                  setSubmitted(true);
                  setSearchParams((prev) => {
                    const params = new URLSearchParams(prev);
                    params.set('tab', 'drilldown');
                    params.set('module', next);
                    return params;
                  }, { replace: true });
                } else {
                  setSubmitted(false);
                }
              }}
            onSubmit={submitReview}
            onClear={clearReview}
            submitting={loading}
            disabled={!moduleId}
            fallbackTotal={fallbackTotal}
          />

      {!submitted && !data ? (
        <EmptyState
          title="Choose a module to review"
              description="Pick a module, set From and To, then Submit. Team, inbox, and uploads still open as soon as you choose them."
              action={
                <button type="button" className="btn secondary" onClick={() => setDashboardView('overview')}>
                  Back to overview
                </button>
              }
        />
      ) : null}

          {loading && !data && !isEmbeddedModule ? (
            <p className="muted">Loading review…</p>
          ) : null}

      {submitted && moduleId === 'logistics' ? (
        <div className="module-review-logistics">
          <Suspense fallback={<p className="muted">Loading Movement One…</p>}>
            <LogisticsHubPage embedded initialFrom={from} initialTo={to} />
          </Suspense>
        </div>
      ) : null}

      {submitted && moduleId === 'camps' && canSeeCampOps ? (
        <div className="module-review-logistics module-review-camps">
          <Suspense fallback={<p className="muted">Loading Camp One board…</p>}>
            <CampOperationsBoard
              embedded
              initialFrom={from}
              initialTo={to}
              reviewPreset={preset}
            />
          </Suspense>
        </div>
      ) : null}

      {submitted && moduleId === 'audit' ? (
        <div className="module-review-logistics">
          <Suspense fallback={<p className="muted">Loading Activity Log…</p>}>
            <AuditPage embedded initialFrom={from} initialTo={to} />
          </Suspense>
        </div>
      ) : null}

      {submitted && moduleId === 'users' ? (
        <div className="module-review-logistics">
          <Suspense fallback={<p className="muted">Loading team…</p>}>
            <UsersPage embedded />
          </Suspense>
        </div>
      ) : null}

      {submitted && moduleId === 'notifications' ? (
        <div className="module-review-logistics">
          <Suspense fallback={<p className="muted">Loading inbox…</p>}>
            <NotificationsPage embedded />
          </Suspense>
        </div>
      ) : null}

      {submitted && moduleId === 'imports' ? (
        <div className="module-review-logistics">
          <Suspense fallback={<p className="muted">Loading uploads…</p>}>
            <ImportsPage embedded />
          </Suspense>
        </div>
      ) : null}

      {data && !isEmbeddedModule ? (
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
        </OpsReviewSlotProvider>
      ) : null}
    </PageShell>
  );
}
