import { useState } from 'react';

export default function LogisticsOutputPage() {
  const [hcw, setHcw] = useState('');

  return (
    <div className="logistics-output">
      <p className="muted" style={{ marginTop: 0 }}>
        HCW inventory dashboard — per-HCW stock balance (on-hand with the field resource).
      </p>

      <div className="logistics-kpis" role="group" aria-label="HCW output snapshot">
        <div className="logistics-kpi">
          <strong>—</strong>
          <span>HCWs with stock</span>
        </div>
        <div className="logistics-kpi">
          <strong>—</strong>
          <span>Total on-hand qty</span>
        </div>
        <div className="logistics-kpi">
          <strong>—</strong>
          <span>Inventory value</span>
        </div>
      </div>

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search HCW…"
          value={hcw}
          onChange={(e) => setHcw(e.target.value)}
        />
        <button className="btn secondary" type="button" disabled>
          Search
        </button>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>HCW</th>
              <th>Items</th>
              <th className="num">On-hand qty</th>
              <th className="num">Value</th>
              <th>Last movement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5}>
                <div className="inv-empty">
                  <strong>No HCW balances yet</strong>
                  <p className="muted">
                    Per-HCW balances will populate when dispatch / assignment posts stock to field
                    resources.
                    {hcw ? ` Search ready for “${hcw}”.` : null}
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
