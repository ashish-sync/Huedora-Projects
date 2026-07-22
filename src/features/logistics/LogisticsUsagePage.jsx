import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { formatDate } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';

export default function LogisticsUsagePage() {
  const { can } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const [rows, setRows] = useState([]);
  const [hcw, setHcw] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (hcw.trim()) params.set('hcw', hcw.trim());
      if (location.trim()) params.set('location', location.trim());
      const res = await api(`/logistics/usage?${params}`);
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [hcw, location]);

  useEffect(() => {
    load();
  }, [load]);

  const patchCell = async (id, patch) => {
    if (!canWrite) return;
    setBusyId(id);
    setError('');
    setMsg('');
    try {
      await api(`/logistics/usage/${id}`, { method: 'PATCH', body: patch });
      setMsg('Usage updated. Dashboard Used and Wastage figures will refresh.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  const totalUsed = rows.reduce((s, r) => s + (Number(r.screenCount) || 0), 0);
  const totalWaste = rows.reduce((s, r) => s + (Number(r.wastage) || 0), 0);

  return (
    <div className="logistics-usage">
      <p className="muted" style={{ marginTop: 0 }}>
        Consumption is auto-synced from <strong>Camp One</strong> (approved camps). Screen Count
        feeds dashboard <strong>Used</strong>; Wastage feeds <strong>Wastage</strong>. Field Balance
        = Goods Issue − Used − Wastage.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="module-dash-kpis" data-count="3" role="group" aria-label="Usage totals">
        <div className="module-kpi">
          <strong>{totalUsed.toLocaleString()}</strong>
          <span>Used (Screen Count)</span>
        </div>
        <div className="module-kpi">
          <strong>{totalWaste.toLocaleString()}</strong>
          <span>Wastage</span>
        </div>
        <div className="module-kpi">
          <strong>{rows.length}</strong>
          <span>Usage rows</span>
        </div>
      </div>

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Filter by HCW…"
          value={hcw}
          onChange={(e) => setHcw(e.target.value)}
        />
        <input
          className="esign-search inv-search"
          placeholder="Filter by location…"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
        <Link className="btn secondary" to="/camps">
          Open Camp One
        </Link>
      </div>

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>HCW ID</th>
              <th>HCW Name</th>
              <th>Client</th>
              <th>Process</th>
              <th>Product Category</th>
              <th>Dr Name</th>
              <th>Machine City</th>
              <th>Camp Date</th>
              <th className="num">Screen Count</th>
              <th className="num">Wastage</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.hcwId || '-'}</td>
                <td>{r.hcwName || '-'}</td>
                <td>{r.clientName || '-'}</td>
                <td>{r.processName || '-'}</td>
                <td>
                  <strong>{r.inventoryType || r.productName || '-'}</strong>
                </td>
                <td>{r.doctorName || '-'}</td>
                <td>{r.machineCity || '-'}</td>
                <td className="mono-sm">{r.campDate ? formatDate(r.campDate) : '-'}</td>
                <td className="num">
                  {canWrite ? (
                    <input
                      className="ilog-usage-num"
                      type="number"
                      min="0"
                      disabled={busyId === r._id}
                      defaultValue={r.screenCount ?? 0}
                      key={`${r._id}-sc-${r.screenCount}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== Number(r.screenCount)) patchCell(r._id, { screenCount: v });
                      }}
                    />
                  ) : (
                    r.screenCount ?? 0
                  )}
                </td>
                <td className="num">
                  {canWrite ? (
                    <input
                      className="ilog-usage-num"
                      type="number"
                      min="0"
                      disabled={busyId === r._id}
                      defaultValue={r.wastage ?? 0}
                      key={`${r._id}-w-${r.wastage}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== Number(r.wastage)) patchCell(r._id, { wastage: v });
                      }}
                    />
                  ) : (
                    r.wastage ?? 0
                  )}
                </td>
                <td>
                  <span className="badge tone-neutral">{r.source || '-'}</span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={11} className="muted">
                  No consumption yet. Approve camps in Camp One to auto-create rows, then enter
                  Screen Count and Wastage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
