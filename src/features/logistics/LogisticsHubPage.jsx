import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { api } from '../../shared/api.js';

const MAP_VIEW = { width: 420, height: 480, minLon: 68, maxLon: 97.5, minLat: 6.5, maxLat: 37.5 };
const CITY_COORDS = {
  mumbai: [19.076, 72.877],
  pune: [18.52, 73.856],
  delhi: [28.614, 77.209],
  'new delhi': [28.614, 77.209],
  bengaluru: [12.972, 77.594],
  bangalore: [12.972, 77.594],
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
  patna: [25.595, 85.137],
  raipur: [21.251, 81.63],
  ranchi: [23.344, 85.309],
  guwahati: [26.144, 91.736],
  bhubaneswar: [20.296, 85.825],
  kochi: [9.932, 76.267],
  coimbatore: [11.016, 76.956],
  visakhapatnam: [17.687, 83.219],
  chandigarh: [30.733, 76.779],
};
const STATE_COORDS = {
  'andaman and nicobar islands': [11.741, 92.659],
  'andhra pradesh': [15.912, 79.74],
  'arunachal pradesh': [28.218, 94.728],
  assam: [26.201, 92.938],
  bihar: [25.096, 85.313],
  chandigarh: [30.733, 76.779],
  chhattisgarh: [21.279, 81.866],
  delhi: [28.704, 77.102],
  goa: [15.3, 74.124],
  gujarat: [22.259, 71.192],
  haryana: [29.059, 76.086],
  'himachal pradesh': [31.105, 77.173],
  'jammu and kashmir': [33.779, 76.576],
  jharkhand: [23.61, 85.28],
  karnataka: [15.318, 75.714],
  kerala: [10.851, 76.271],
  ladakh: [34.152, 77.577],
  'madhya pradesh': [22.974, 78.656],
  maharashtra: [19.751, 75.714],
  manipur: [24.664, 93.906],
  meghalaya: [25.467, 91.366],
  mizoram: [23.165, 92.938],
  nagaland: [26.159, 94.563],
  odisha: [20.951, 85.099],
  puducherry: [11.942, 79.808],
  punjab: [31.147, 75.341],
  rajasthan: [27.024, 74.218],
  sikkim: [27.533, 88.512],
  'tamil nadu': [11.127, 78.657],
  telangana: [18.112, 79.019],
  tripura: [23.941, 91.989],
  'uttar pradesh': [26.847, 80.947],
  uttarakhand: [30.067, 79.019],
  'west bengal': [22.987, 87.855],
};

function projectPoint([lat, lon]) {
  return [
    ((lon - MAP_VIEW.minLon) / (MAP_VIEW.maxLon - MAP_VIEW.minLon)) * MAP_VIEW.width,
    ((MAP_VIEW.maxLat - lat) / (MAP_VIEW.maxLat - MAP_VIEW.minLat)) * MAP_VIEW.height,
  ];
}

function locationPoint(city, state) {
  const cityKey = String(city || '').trim().toLowerCase();
  const stateKey = String(state || '').trim().toLowerCase();
  const coords = CITY_COORDS[cityKey] || STATE_COORDS[stateKey];
  if (!coords) return null;
  const point = projectPoint(coords);
  if (!CITY_COORDS[cityKey] && cityKey) {
    const hash = [...cityKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    point[0] += (hash % 13) - 6;
    point[1] += ((hash * 7) % 13) - 6;
  }
  return point;
}

function formatNum(n, metric) {
  const num = Number(n) || 0;
  if (metric === 'amount') {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return Math.round(num).toLocaleString();
}

function IndiaInventoryMap({ cities, metric, focusedCustodian }) {
  const [hover, setHover] = useState(null);
  const valueKey = metric === 'amount' ? 'amount' : 'qty';
  const max = Math.max(...cities.map((city) => Number(city[valueKey]) || 0), 1);
  const points = cities
    .map((city) => ({
      ...city,
      value: Number(city[valueKey]) || 0,
      point: locationPoint(city.city, city.state),
    }))
    .filter((city) => city.value > 0 && city.point);
  const focusPoint = focusedCustodian
    ? locationPoint(focusedCustodian.city, focusedCustodian.state)
    : null;
  const zoomWidth = 170;
  const zoomHeight = 190;
  const viewBox = focusPoint
    ? `${Math.max(0, Math.min(focusPoint[0] - zoomWidth / 2, MAP_VIEW.width - zoomWidth))} ${Math.max(
        0,
        Math.min(focusPoint[1] - zoomHeight / 2, MAP_VIEW.height - zoomHeight)
      )} ${zoomWidth} ${zoomHeight}`
    : `0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`;

  return (
    <div className="ilog-dash-map-wrap">
      <svg
        className="ilog-dash-map"
        viewBox={viewBox}
        role="img"
        aria-label={
          focusPoint
            ? `India inventory map focused on ${focusedCustodian.name}`
            : 'Inventory distribution across India'
        }
      >
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
        {points.map((city) => {
          const radius = 5 + (city.value / max) * 9;
          return (
            <circle
              key={`${city.city}-${city.state}`}
              className="ilog-dash-map-dot"
              cx={city.point[0]}
              cy={city.point[1]}
              r={radius}
              onMouseEnter={() => setHover(city)}
              onMouseLeave={() => setHover(null)}
            >
              <title>
                {city.city}: {formatNum(city.value, metric)}
              </title>
            </circle>
          );
        })}
      </svg>
      {focusPoint && (
        <div className="ilog-map-focus">
          <strong>{focusedCustodian.name}</strong>
          <span>
            {[focusedCustodian.city, focusedCustodian.state].filter(Boolean).join(', ')}
          </span>
        </div>
      )}
      {hover && (
        <div className="ilog-dash-map-tip" role="status">
          <strong>{hover.city}</strong>
          <span>{formatNum(hover.value, metric)}</span>
        </div>
      )}
      {!points.length && <p className="ilog-dash-empty muted">No mapped city data yet</p>}
    </div>
  );
}

function KpiGroup({ title, items, metric, columns }) {
  return (
    <section className="ilog-kpi-group" aria-label={title}>
      <h3>{title}</h3>
      <div
        className={`ilog-dash-kpi-row${columns === 4 ? ' ilog-dash-kpi-row--4' : ''}`}
      >
        {items.map((item) => (
          <div key={item.label} className="ilog-dash-kpi">
            <strong>{formatNum(item.value, metric)}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
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
  const focusedCustodian =
    hcwId !== 'all'
      ? (data.filters?.hcws || []).find((custodian) => String(custodian.id) === String(hcwId))
      : null;

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
    <div className="ilog-hub">
      <section className="ilog-quick-actions" aria-label="Quick actions">
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
      </section>

      <section className="ilog-dash" aria-busy={busy}>
        <header className="ilog-dash-header">
          <div>
            <p className="ilog-dash-eyebrow">Inventory overview</p>
            <h2>Stock movement and field balance</h2>
            <p>Monitor receipts, dispatches, usage, expiry health, and inventory distribution.</p>
          </div>
          <div className="ilog-dash-metric" role="group" aria-label="Display metric">
            <button
              type="button"
              className={`ilog-dash-metric-btn${metric === 'quantity' ? ' is-active' : ''}`}
              onClick={() => setMetric('quantity')}
            >
              Quantity
            </button>
            <button
              type="button"
              className={`ilog-dash-metric-btn${metric === 'amount' ? ' is-active' : ''}`}
              onClick={() => setMetric('amount')}
            >
              Amount
            </button>
          </div>
        </header>

        {error && (
          <div className="am-banner is-error" role="status">
            {error}
          </div>
        )}

        <div className="ilog-filter-panel">
          <div className="ilog-filter-heading">
            <div>
              <strong>Filters</strong>
              <span>Refine all dashboard metrics</span>
            </div>
            {busy && <span className="muted ilog-dash-busy">Updating…</span>}
          </div>
          <div className="ilog-dash-filters">
            <div className="ilog-dash-filter">
              <label htmlFor="ilog-from">From date</label>
              <input
                id="ilog-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="ilog-dash-filter">
              <label htmlFor="ilog-to">To date</label>
              <input
                id="ilog-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="ilog-dash-filter">
              <label htmlFor="ilog-inv">Product category</label>
              <AdaptiveSelect
                id="ilog-inv"
                value={inventoryType}
                onChange={(e) => setInventoryType(e.target.value)}
              >
                <option value="all">All categories</option>
                {(data.filters?.inventoryTypes || []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="ilog-dash-filter">
              <label htmlFor="ilog-hcw">Custodian / HCW</label>
              <AdaptiveSelect
                id="ilog-hcw"
                value={hcwId}
                onChange={(e) => setHcwId(e.target.value)}
              >
                <option value="all">All custodians</option>
                {(data.filters?.hcws || []).map((hcw) => (
                  <option key={hcw.id} value={hcw.id}>
                    {hcw.id}
                    {hcw.name && hcw.name !== hcw.id ? ` — ${hcw.name}` : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            {(dateFrom || dateTo || inventoryType !== 'all' || hcwId !== 'all') && (
              <button
                type="button"
                className="btn secondary ilog-dash-clear-dates"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setInventoryType('all');
                  setHcwId('all');
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        <div className="ilog-kpi-sections">
          <KpiGroup title="Inventory flow" items={row1} metric={m} />
          <KpiGroup title="Field usage" items={row2} metric={m} />
          <KpiGroup title="Expiry health" items={row3} metric={m} columns={4} />
        </div>

        <div className="ilog-dash-viz">
          <section className="ilog-dash-panel">
            <header>
              <h3>Inventory by city</h3>
              <p>Select a custodian to zoom into their location; reset filters for all India.</p>
            </header>
            <IndiaInventoryMap
              cities={data.byCity || []}
              metric={metric}
              focusedCustodian={focusedCustodian}
            />
          </section>
        </div>
      </section>
    </div>
  );
}
