import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';

/** Approximate lat/lng for common India cities used on the dashboard map */
const CITY_COORDS = {
  mumbai: [19.076, 72.877],
  pune: [18.52, 73.856],
  delhi: [28.613, 77.209],
  'new delhi': [28.613, 77.209],
  bangalore: [12.972, 77.594],
  bengaluru: [12.972, 77.594],
  hyderabad: [17.385, 78.487],
  chennai: [13.083, 80.27],
  kolkata: [22.573, 88.364],
  ahmedabad: [23.023, 72.571],
  jaipur: [26.912, 75.787],
  lucknow: [26.847, 80.947],
  indore: [22.719, 75.858],
  bhopal: [23.26, 77.413],
  nagpur: [21.146, 79.089],
  surat: [21.17, 72.831],
  kanpur: [26.45, 80.332],
  patna: [25.595, 85.137],
  raipur: [21.251, 81.63],
  ranchi: [23.344, 85.309],
  guwahati: [26.144, 91.736],
  bhubaneswar: [20.296, 85.825],
  thiruvananthapuram: [8.524, 76.937],
  trivandrum: [8.524, 76.937],
  coimbatore: [11.016, 76.956],
  madurai: [9.925, 78.12],
  vijayawada: [16.506, 80.648],
  visakhapatnam: [17.687, 83.219],
  chandigarh: [30.733, 76.779],
  ludhiana: [30.901, 75.857],
  amritsar: [31.634, 74.872],
  jodhpur: [26.239, 73.025],
  jalandhar: [31.326, 75.576],
  faridabad: [28.408, 77.318],
  noida: [28.535, 77.391],
  gurgaon: [28.46, 77.027],
  gurugram: [28.46, 77.027],
  aurangabad: [19.876, 75.343],
  nashik: [19.997, 73.79],
  vadodara: [22.307, 73.181],
  rajkot: [22.304, 70.802],
  jamnagar: [22.471, 70.058],
  kolhapur: [16.705, 74.243],
  satara: [17.68, 74.018],
  dhule: [20.903, 74.775],
  akola: [20.7, 77.009],
  yavatmal: [20.39, 78.131],
  chandrapur: [19.97, 79.3],
  warangal: [17.969, 79.594],
  karimnagar: [18.439, 79.129],
  kurnool: [15.829, 78.037],
  bathinda: [30.211, 74.945],
  kanyakumari: [8.088, 77.538],
  madhya: [23.473, 77.947],
  assam: [26.201, 92.938],
  'south 24 paragnas': [22.365, 88.431],
  'south 24 parganas': [22.365, 88.431],
  midnapore: [22.425, 87.319],
  burdwan: [23.232, 87.861],
};

const MAP_VIEW = { w: 420, h: 480, minLon: 68, maxLon: 97.5, minLat: 6.5, maxLat: 37.5 };

function project(lat, lon) {
  const x = ((lon - MAP_VIEW.minLon) / (MAP_VIEW.maxLon - MAP_VIEW.minLon)) * MAP_VIEW.w;
  const y = ((MAP_VIEW.maxLat - lat) / (MAP_VIEW.maxLat - MAP_VIEW.minLat)) * MAP_VIEW.h;
  return [x, y];
}

function cityPoint(city) {
  const key = String(city || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const coords = CITY_COORDS[key];
  if (!coords) return null;
  return project(coords[0], coords[1]);
}

function formatNum(n, metric) {
  const num = Number(n) || 0;
  if (metric === 'amount') {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return Math.round(num).toLocaleString();
}

/** Simple slice-and-dice treemap */
function layoutTreemap(items, metric, width, height) {
  const valueKey = metric === 'amount' ? 'amount' : 'qty';
  const data = items
    .map((d) => ({ ...d, value: Number(d[valueKey]) || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!data.length) return [];

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const rects = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let remaining = total;

  data.forEach((d, i) => {
    const isLast = i === data.length - 1;
    const frac = d.value / remaining;
    const horizontal = w >= h;
    let rw;
    let rh;
    if (isLast) {
      rw = w;
      rh = h;
    } else if (horizontal) {
      rw = w * frac;
      rh = h;
    } else {
      rw = w;
      rh = h * frac;
    }
    rects.push({
      name: d.name,
      value: d.value,
      x,
      y,
      w: Math.max(rw, 0),
      h: Math.max(rh, 0),
      i,
    });
    if (horizontal) {
      x += rw;
      w -= rw;
    } else {
      y += rh;
      h -= rh;
    }
    remaining -= d.value;
  });

  return rects;
}

const TREE_COLORS = ['#7eb6d9', '#3d7ea6', '#5a9fc4', '#2c5f7c', '#a8cfe0', '#e8a87c', '#c4dce8'];

function IndiaMap({ cities, metric }) {
  const [hover, setHover] = useState(null);
  const valueKey = metric === 'amount' ? 'amount' : 'qty';
  const max = Math.max(...cities.map((c) => Number(c[valueKey]) || 0), 1);

  const points = cities
    .map((c) => {
      const pt = cityPoint(c.city);
      if (!pt) return null;
      const v = Number(c[valueKey]) || 0;
      const r = 4 + (v / max) * 10;
      return { ...c, x: pt[0], y: pt[1], r, v };
    })
    .filter(Boolean);

  return (
    <div className="ilog-dash-map-wrap">
      <svg
        className="ilog-dash-map"
        viewBox={`0 0 ${MAP_VIEW.w} ${MAP_VIEW.h}`}
        role="img"
        aria-label="Inventory by city across India"
      >
        {/* Simplified India landmass silhouette */}
        <path
          className="ilog-dash-map-land"
          d="M210 40 L235 48 L255 70 L270 95 L285 120 L295 150 L300 180 L305 210 L300 250
             L290 290 L275 320 L255 350 L240 380 L220 410 L200 430 L175 440 L150 430 L130 400
             L115 370 L105 340 L95 300 L90 260 L85 220 L80 180 L75 150 L70 120 L85 95 L110 75
             L140 55 L170 42 Z"
        />
        <path
          className="ilog-dash-map-land ilog-dash-map-land--ne"
          d="M270 95 L300 85 L330 100 L350 130 L340 160 L320 170 L300 155 L285 130 Z"
        />
        {points.map((p) => (
          <circle
            key={p.city}
            className="ilog-dash-map-dot"
            cx={p.x}
            cy={p.y}
            r={p.r}
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover && (
        <div className="ilog-dash-map-tip" role="status">
          <strong>{hover.city}</strong>
          <span>{formatNum(hover.v, metric)}</span>
        </div>
      )}
      {!points.length && <p className="ilog-dash-empty muted">No city data yet</p>}
    </div>
  );
}

function InventoryTreemap({ items, metric }) {
  const width = 560;
  const height = 320;
  const rects = useMemo(() => layoutTreemap(items, metric, width, height), [items, metric]);

  if (!rects.length) {
    return <p className="ilog-dash-empty muted">No inventory type breakdown yet</p>;
  }

  return (
    <svg
      className="ilog-dash-treemap"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Inventory type treemap"
    >
      {rects.map((r) => (
        <g key={r.name}>
          <rect
            x={r.x + 1}
            y={r.y + 1}
            width={Math.max(r.w - 2, 0)}
            height={Math.max(r.h - 2, 0)}
            fill={TREE_COLORS[r.i % TREE_COLORS.length]}
            rx={2}
          />
          {r.w > 70 && r.h > 36 && (
            <>
              <text className="ilog-dash-tree-label" x={r.x + 10} y={r.y + 22}>
                {r.name.length > 22 ? `${r.name.slice(0, 20)}…` : r.name}
              </text>
              <text className="ilog-dash-tree-value" x={r.x + r.w - 10} y={r.y + r.h - 10} textAnchor="end">
                {formatNum(r.value, metric)}
              </text>
            </>
          )}
          {r.w > 40 && r.h > 24 && r.w <= 70 && (
            <text className="ilog-dash-tree-value" x={r.x + r.w / 2} y={r.y + r.h / 2 + 4} textAnchor="middle">
              {formatNum(r.value, metric)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const EMPTY = {
  filters: { months: [], inventoryTypes: [], hcws: [] },
  kpis: {},
  byCity: [],
  byInventoryType: [],
};

export default function LogisticsHubPage() {
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [inventoryType, setInventoryType] = useState('all');
  const [hcwId, setHcwId] = useState('all');
  const [metric, setMetric] = useState('quantity');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (inventoryType && inventoryType !== 'all') params.set('inventoryType', inventoryType);
      if (hcwId && hcwId !== 'all') params.set('hcwId', hcwId);
      const qs = params.toString();
      const res = await api(`/logistics/dashboard${qs ? `?${qs}` : ''}`);
      setData(res.data || EMPTY);
    } catch (e) {
      setError(e.message);
      setData(EMPTY);
    } finally {
      setBusy(false);
    }
  }, [dateFrom, dateTo, inventoryType, hcwId]);

  useEffect(() => {
    load();
  }, [load]);

  const k = data.kpis || {};
  const m = metric;
  const unit = m === 'amount' ? 'Amount' : 'Quantity';

  const row1 = [
    { label: `Inward ${unit}`, value: m === 'amount' ? k.inwardAmount : k.inwardQty },
    { label: `Outward ${unit}`, value: m === 'amount' ? k.outwardAmount : k.outwardQty },
    { label: `Balance ${unit}`, value: m === 'amount' ? k.balanceAmount : k.balanceQty },
  ];
  const row2 = [
    { label: `Used ${unit}`, value: m === 'amount' ? k.usedAmount : k.usedQty },
    { label: `Wastage ${unit}`, value: m === 'amount' ? k.wastageAmount : k.wastageQty },
    {
      label: `Field Balance ${unit}`,
      value: m === 'amount' ? k.fieldBalanceAmount : k.fieldBalanceQty,
    },
  ];
  const row3 = [
    { label: `Safe ${unit}`, value: m === 'amount' ? k.safeAmount : k.safeQty },
    { label: `Caution ${unit}`, value: m === 'amount' ? k.cautionAmount : k.cautionQty },
    { label: `Critical ${unit}`, value: m === 'amount' ? k.criticalAmount : k.criticalQty },
    { label: `Expired ${unit}`, value: m === 'amount' ? k.expiredAmount : k.expiredQty },
  ];

  return (
    <div className="ilog-hub-split">
      <div className="ilog-dash">
      {error && (
        <div className="am-banner is-error" role="status">
          {error}
        </div>
      )}

      <div className="ilog-dash-filters">
        <div className="ilog-dash-filter">
          <label htmlFor="ilog-from">From</label>
          <input
            id="ilog-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="ilog-dash-filter">
          <label htmlFor="ilog-to">To</label>
          <input
            id="ilog-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            className="btn secondary ilog-dash-clear-dates"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
          >
            Clear dates
          </button>
        )}
        <div className="ilog-dash-filter">
          <label htmlFor="ilog-inv">Product Category</label>
          <select
            id="ilog-inv"
            value={inventoryType}
            onChange={(e) => setInventoryType(e.target.value)}
          >
            <option value="all">All</option>
            {(data.filters?.inventoryTypes || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="ilog-dash-filter">
          <label htmlFor="ilog-hcw">HCW ID</label>
          <select id="ilog-hcw" value={hcwId} onChange={(e) => setHcwId(e.target.value)}>
            <option value="all">All</option>
            {(data.filters?.hcws || []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.id}
                {h.name && h.name !== h.id ? ` — ${h.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="ilog-dash-metric" role="group" aria-label="Metric">
          <button
            type="button"
            className={`ilog-dash-metric-btn${metric === 'amount' ? ' is-active' : ''}`}
            onClick={() => setMetric('amount')}
          >
            Amount
          </button>
          <button
            type="button"
            className={`ilog-dash-metric-btn${metric === 'quantity' ? ' is-active' : ''}`}
            onClick={() => setMetric('quantity')}
          >
            Quantity
          </button>
        </div>

        {busy && <span className="muted ilog-dash-busy">Updating…</span>}
      </div>

      <div className="ilog-dash-kpi-row" role="group" aria-label="Flow">
        {row1.map((c) => (
          <div key={c.label} className="ilog-dash-kpi">
            <strong>{formatNum(c.value, m)}</strong>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="ilog-dash-kpi-row" role="group" aria-label="Usage">
        {row2.map((c) => (
          <div key={c.label} className="ilog-dash-kpi">
            <strong>{formatNum(c.value, m)}</strong>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="ilog-dash-kpi-row ilog-dash-kpi-row--4" role="group" aria-label="Expiry health">
        {row3.map((c) => (
          <div key={c.label} className="ilog-dash-kpi">
            <strong>{formatNum(c.value, m)}</strong>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="ilog-dash-viz">
        <div className="ilog-dash-panel">
          <IndiaMap cities={data.byCity || []} metric={metric} />
        </div>
        <div className="ilog-dash-panel">
          <InventoryTreemap items={data.byInventoryType || []} metric={metric} />
        </div>
      </div>
      </div>

      <aside className="ilog-rail" aria-label="Inventory movements">
        <Link to="/logistics/inward" className="ilog-rail-card">
          <span className="ilog-rail-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="10" y="14" width="22" height="22" rx="3" />
              <path d="M32 25h10M38 19l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 22h10M16 28h7" strokeLinecap="round" />
            </svg>
          </span>
          <span className="ilog-rail-body">
            <strong>Inward</strong>
            <span>Seller receipts, field returns / callbacks — all land in warehouse.</span>
            <em>Open →</em>
          </span>
        </Link>

        <Link to="/logistics/outward" className="ilog-rail-card">
          <span className="ilog-rail-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="16" y="14" width="22" height="22" rx="3" />
              <path d="M16 25H6M12 19l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 22h10M22 28h7" strokeLinecap="round" />
            </svg>
          </span>
          <span className="ilog-rail-body">
            <strong>Outward</strong>
            <span>Manual dispatch or fulfill a Request Center logistics request.</span>
            <em>Open →</em>
          </span>
        </Link>
      </aside>
    </div>
  );
}
