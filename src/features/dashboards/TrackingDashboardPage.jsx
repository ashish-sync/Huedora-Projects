import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function statusTone(status) {
  const s = String(status || '');
  if (s === 'Agreement Signed') return 'ok';
  if (s === 'Lost/Stolen' || s === 'Untraceable' || s === 'End of Life') return 'danger';
  if (s === 'Under Repairs' || s === 'With Kartavya') return 'warn';
  if (s === 'Not Applicable') return 'neutral';
  return 'neutral';
}

function conditionTone(key) {
  if (key === 'SAFE') return 'ok';
  if (key === 'CAUTION') return 'warn';
  if (key === 'DANGER') return 'danger';
  return 'neutral';
}

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

export default function TrackingDashboardPage() {
  const { can } = useAuth();
  const canDownload = can('dashboards:read') || can('*');
  const canViewValue = can('assets:view-value') || can('*');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState('all');

  const applyPreset = (id) => {
    setPreset(id);
    const r = rangeForPreset(id);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    api(`/dashboards/tracking${qs ? `?${qs}` : ''}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const rangeLabel = useMemo(() => {
    if (!from && !to) return 'All time';
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    return `Through ${to}`;
  }, [from, to]);

  const inventory = data?.inventory || { qty: 0, value: 0, statuses: [] };
  const verification = data?.verification || {
    qty: 0,
    value: 0,
    conditions: [
      { key: 'SAFE', label: 'Safe', qty: 0, value: 0 },
      { key: 'CAUTION', label: 'Caution', qty: 0, value: 0 },
      { key: 'DANGER', label: 'Danger', qty: 0, value: 0 },
    ],
  };

  const downloadSummary = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/dashboards/export', 'DHub_Dashboard_Summary.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.DASHBOARD }]}
      title={MODULE.DASHBOARD}
      description="Asset Inventory by status (Qty & Value) and Asset Verification condition (Safe / Caution / Danger)."
      actions={
        <>
          <button className="btn secondary" type="button" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {canDownload && (
            <button
              className="btn secondary"
              type="button"
              disabled={exportBusy}
              onClick={downloadSummary}
            >
              {exportBusy ? 'Downloading…' : 'Download Excel'}
            </button>
          )}
        </>
      }
    >
      <section className="card track-range" aria-label="Date range">
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
        <div className="track-range-fields">
          <label className="track-range-field">
            <span>From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                const next = e.target.value;
                setFrom(next);
                setPreset(detectPreset(next, to));
              }}
            />
          </label>
          <label className="track-range-field">
            <span>To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                const next = e.target.value;
                setTo(next);
                setPreset(detectPreset(from, next));
              }}
            />
          </label>
          <p className="muted track-range-hint">
            Inventory: assets onboarded in range · Verification: condition for{' '}
            {data?.periodKey || 'selected end month'}
            {rangeLabel !== 'All time' ? ` · ${rangeLabel}` : ''}
          </p>
        </div>
      </section>

      {error && (
        <div className="am-banner is-error" role="alert">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="muted">Loading tracking data…</p>
      ) : (
        <div className="track-sections">
          <section className="card track-panel">
            <div className="track-panel-head">
              <div>
                <h2>{MODULE.ASSET_INVENTORY}</h2>
                <p className="muted">
                  {FIELD.ASSET_STATUS} — onboarded in selected range
                </p>
              </div>
              <Link className="btn secondary btn-compact" to="/assets">
                Open inventory
              </Link>
            </div>

            <div className="track-table-wrap">
              <table className="track-table">
                <thead>
                  <tr>
                    <th>{FIELD.ASSET_STATUS}</th>
                    <th className="num">Qty</th>
                    {canViewValue && <th className="num">Value</th>}
                  </tr>
                </thead>
                <tbody>
                  {(inventory.statuses || []).map((row) => (
                    <tr key={row.status}>
                      <td>
                        <span className={`badge tone-${statusTone(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="num mono-sm">{row.qty || 0}</td>
                      {canViewValue && (
                        <td className="num mono-sm">{formatMoney(row.value)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th className="num">{inventory.qty || 0}</th>
                    {canViewValue && (
                      <th className="num">{formatMoney(inventory.value)}</th>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="card track-panel">
            <div className="track-panel-head">
              <div>
                <h2>{MODULE.ASSET_VERIFICATION}</h2>
                <p className="muted">
                  Safe / Caution / Danger
                  {data?.periodKey ? ` · period ${data.periodKey}` : ''}
                </p>
              </div>
              <Link className="btn secondary btn-compact" to="/verifications">
                Open verification
              </Link>
            </div>

            <div className="track-table-wrap">
              <table className="track-table">
                <thead>
                  <tr>
                    <th>Condition</th>
                    <th className="num">Qty</th>
                    {canViewValue && <th className="num">Value</th>}
                  </tr>
                </thead>
                <tbody>
                  {(verification.conditions || []).map((row) => (
                    <tr key={row.key}>
                      <td>
                        <span className={`badge tone-${conditionTone(row.key)}`}>{row.label}</span>
                      </td>
                      <td className="num mono-sm">{row.qty || 0}</td>
                      {canViewValue && (
                        <td className="num mono-sm">{formatMoney(row.value)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total (signed)</th>
                    <th className="num">{verification.qty || 0}</th>
                    {canViewValue && (
                      <th className="num">{formatMoney(verification.value)}</th>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
