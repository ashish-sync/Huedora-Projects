import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDateRangeLabel } from '../../shared/dateFormat.js';
import { MODULE } from '../../shared/labels.js';
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

export default function TrackingDashboardPage() {
  const { can } = useAuth();
  const canDownload = can('dashboards:read') || can('*');

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

  useEffect(() => {
    const initial = rangeForPreset('month');
    if (initial) {
      setFrom(initial.from);
      setTo(initial.to);
    }
    api('/dashboards/modules')
      .then((r) => {
        const list = r.data || [];
        setModules(list);
        if (list.length && !moduleId) setModuleId(list[0].id);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load catalog once
  }, []);

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

  const submitReview = async (e) => {
    e?.preventDefault?.();
    if (!moduleId) {
      setError('Select a module to review');
      return;
    }
    setError('');
    setSubmitted(true);
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
    data?.summary?.unread != null
      ? { label: 'Unread', value: data.summary.unread }
      : null,
    data?.summary?.active != null
      ? { label: 'Active', value: data.summary.active }
      : null,
    data?.summary?.inactive != null
      ? { label: 'Inactive', value: data.summary.inactive }
      : null,
  ].filter(Boolean);

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.DASHBOARD }]}
      title={MODULE.DASHBOARD}
      description="Select a module and date range, then submit. Movement One opens the stock dashboard."
      actions={
        <>
          {submitted && moduleId === 'logistics' ? (
            <Link className="btn secondary" to="/logistics">
              Open Movement One
            </Link>
          ) : null}
          {data?.linkTo && moduleId !== 'logistics' ? (
            <Link className="btn secondary" to={data.linkTo}>
              Open module
            </Link>
          ) : null}
          {canDownload && data && moduleId !== 'logistics' ? (
            <button
              className="btn secondary"
              type="button"
              disabled={exportBusy || loading}
              onClick={downloadReview}
            >
              {exportBusy ? 'Downloading…' : 'Download Excel'}
            </button>
          ) : null}
        </>
      }
      kpis={data ? kpiItems : undefined}
    >
      <div className="card track-range" aria-label="Module review filters">
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

      {error ? (
        <div className="am-banner is-error" role="alert">
          {error}
        </div>
      ) : null}

      {!submitted && !data ? (
        <EmptyState
          title="Choose a module and date range"
          description="Pick what you want to review, set From and To, then click Submit."
        />
      ) : null}

      {loading && !data && moduleId !== 'logistics' ? <p className="muted">Loading review…</p> : null}

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
            <Link className="btn secondary btn-compact" to="/logistics">
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
            <div className="track-table-wrap card table-wrap" style={{ boxShadow: 'none', border: 0 }}>
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
                        <td key={col.key} className={col.key === 'when' ? 'mono-sm muted' : undefined}>
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
    </PageShell>
  );
}
