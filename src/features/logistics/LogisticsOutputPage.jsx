import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function LogisticsOutputPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api('/logistics/dashboard');
      setRows(res.data?.byHcw || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        String(r.name || '').toLowerCase().includes(needle) ||
        String(r.id || '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.qty += Number(r.qty) || 0;
        acc.amount += Number(r.amount) || 0;
        return acc;
      },
      { qty: 0, amount: 0 }
    );
  }, [filtered]);

  return (
    <div className="logistics-output">
      <p className="muted" style={{ marginTop: 0 }}>
        Field stock still with each resource (Outward minus Returns, Used, and Wastage).
      </p>

      {error ? (
        <div className="am-banner is-error" role="status">
          {error}
        </div>
      ) : null}

      <div className="logistics-kpis" role="group" aria-label="Field output snapshot">
        <div className="logistics-kpi">
          <strong>{filtered.length}</strong>
          <span>Resources with stock</span>
        </div>
        <div className="logistics-kpi">
          <strong>{totals.qty.toLocaleString()}</strong>
          <span>Total on-hand qty</span>
        </div>
        <div className="logistics-kpi">
          <strong>{formatMoney(totals.amount)}</strong>
          <span>Inventory value</span>
        </div>
      </div>

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search resource…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn secondary" type="button" onClick={load} disabled={busy}>
          {busy ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>ID</th>
              <th className="num">On-hand qty</th>
              <th className="num">Value</th>
              <th>Last movement</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name || '-'}</strong>
                </td>
                <td className="mono-sm">{r.id || '-'}</td>
                <td className="num">{Number(r.qty || 0).toLocaleString()}</td>
                <td className="num">{formatMoney(r.amount)}</td>
                <td className="mono-sm">
                  {r.lastAt ? new Date(r.lastAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5}>
                  <div className="inv-empty">
                    <strong>No field balances yet</strong>
                    <p className="muted">
                      Balances appear after outward dispatch to a field resource. Returns and usage
                      reduce on-hand qty.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
