import { useCallback, useEffect, useMemo, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import { api } from '../../shared/api.js';
import { OpsReviewSlot } from '../dashboards/OpsReviewHeader.jsx';

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
  vizag: [17.687, 83.219],
  chandigarh: [30.733, 76.779],
  gurgaon: [28.459, 77.027],
  gurugram: [28.459, 77.027],
  noida: [28.535, 77.391],
  thane: [19.218, 72.978],
  'navi mumbai': [19.033, 73.029],
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

function normalizePlaceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\bcity\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function projectPoint([lat, lon]) {
  return [
    ((lon - MAP_VIEW.minLon) / (MAP_VIEW.maxLon - MAP_VIEW.minLon)) * MAP_VIEW.width,
    ((MAP_VIEW.maxLat - lat) / (MAP_VIEW.maxLat - MAP_VIEW.minLat)) * MAP_VIEW.height,
  ];
}

function locationPoint(city, state) {
  const cityKey = normalizePlaceKey(city);
  const stateKey = normalizePlaceKey(state);
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

function placeLabel(city, state) {
  return [city, state].filter(Boolean).join(', ') || 'Unknown';
}

function MovementLocationPreview({ cities = [], routes = [], metric, focusedCustodian }) {
  const [hover, setHover] = useState(null);
  const valueKey = metric === 'amount' ? 'amount' : 'qty';
  const rankedCities = useMemo(
    () => [...cities]
      .filter((city) => (Number(city[valueKey]) || 0) > 0 && String(city.city || '').toLowerCase() !== 'unknown')
      .sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0)),
    [cities, valueKey],
  );
  const maxCity = Math.max(...rankedCities.map((city) => Number(city[valueKey]) || 0), 1);

  const points = rankedCities
    .map((city) => ({
      ...city,
      value: Number(city[valueKey]) || 0,
      point: locationPoint(city.city, city.state),
      label: placeLabel(city.city, city.state),
    }))
    .filter((city) => city.point);

  const routeLines = useMemo(
    () => (routes || [])
      .map((route) => {
        const from = locationPoint(route.fromCity, route.fromState);
        const to = locationPoint(route.toCity, route.toState);
        if (!from || !to) return null;
        return {
          ...route,
          from,
          to,
          value: Number(route[valueKey]) || 0,
          label: `${placeLabel(route.fromCity, route.fromState)} → ${placeLabel(route.toCity, route.toState)}`,
        };
      })
      .filter(Boolean)
      .filter((route) => route.value > 0)
      .slice(0, 24),
    [routes, valueKey],
  );

  const focusPoint = focusedCustodian
    ? locationPoint(focusedCustodian.city, focusedCustodian.state)
    : null;
  const zoomWidth = 170;
  const zoomHeight = 190;
  const viewBox = focusPoint
    ? `${Math.max(0, Math.min(focusPoint[0] - zoomWidth / 2, MAP_VIEW.width - zoomWidth))} ${Math.max(
        0,
        Math.min(focusPoint[1] - zoomHeight / 2, MAP_VIEW.height - zoomHeight),
      )} ${zoomWidth} ${zoomHeight}`
    : `0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`;

  const unmappedCount = rankedCities.length - points.length;

  return (
    <div className="ilog-location-preview">
      {points.length || routeLines.length ? (
        <div className="ilog-dash-map-wrap">
          <svg
            className="ilog-dash-map"
            viewBox={viewBox}
            role="img"
            aria-label={
              focusPoint
                ? `Movement map focused on ${focusedCustodian.name}`
                : 'Movement locations and routes across India'
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
            {routeLines.map((route) => (
              <line
                key={route.label}
                className="ilog-dash-map-route"
                x1={route.from[0]}
                y1={route.from[1]}
                x2={route.to[0]}
                y2={route.to[1]}
                onMouseEnter={() => setHover({ label: route.label, value: route.value })}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {route.label}: {formatNum(route.value, metric)}
                </title>
              </line>
            ))}
            {points.map((city) => {
              const radius = 5 + (city.value / maxCity) * 9;
              return (
                <circle
                  key={city.label}
                  className="ilog-dash-map-dot"
                  cx={city.point[0]}
                  cy={city.point[1]}
                  r={radius}
                  onMouseEnter={() => setHover({ label: city.label, value: city.value })}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>
                    {city.label}: {formatNum(city.value, metric)}
                  </title>
                </circle>
              );
            })}
          </svg>
          {focusPoint ? (
            <div className="ilog-map-focus">
              <strong>{focusedCustodian.name}</strong>
              <span>{placeLabel(focusedCustodian.city, focusedCustodian.state)}</span>
            </div>
          ) : null}
          {hover ? (
            <div className="ilog-dash-map-tip" role="status">
              <strong>{hover.label}</strong>
              <span>{formatNum(hover.value, metric)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ilog-city-list" aria-label="Locations by movement volume">
        {!rankedCities.length ? (
          <p className="ilog-dash-empty muted">No destination cities in this period.</p>
        ) : (
          rankedCities.slice(0, 8).map((city) => {
            const value = Number(city[valueKey]) || 0;
            const label = placeLabel(city.city, city.state);
            return (
              <div key={label} className="ilog-city-row">
                <div className="ilog-city-row-label">
                  <strong title={label}>{label}</strong>
                  <span>{formatNum(value, metric)}</span>
                </div>
                <div className="ilog-city-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(6, (value / maxCity) * 100)}%` }} />
                </div>
              </div>
            );
          })
        )}
        {unmappedCount > 0 ? (
          <p className="ilog-dash-empty muted">
            {unmappedCount} location{unmappedCount === 1 ? '' : 's'} listed without map coordinates.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KpiGroup({ title, items, metric, columns }) {
  return (
    <section className="ilog-kpi-group" aria-label={title}>
      <h3 className="ilog-kpi-group-title">{title}</h3>
      <div className={`ilog-dash-kpi-row${columns === 4 ? ' ilog-dash-kpi-row--4' : ''}`}>
        {items.map((item) => (
          <div
            key={item.label}
            className={`ilog-dash-kpi${item.tone ? ` ilog-dash-kpi--${item.tone}` : ''}`}
          >
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
  routes: [],
  byInventoryType: [],
};

export default function LogisticsHubPage({
  embedded = false,
  initialFrom = '',
  initialTo = '',
} = {}) {
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialFrom || '');
  const [dateTo, setDateTo] = useState(initialTo || '');
  const [inventoryType, setInventoryType] = useState('all');
  const [hcwId, setHcwId] = useState('all');
  const [metric, setMetric] = useState('quantity');
  const [applied, setApplied] = useState({
    dateFrom: initialFrom || '',
    dateTo: initialTo || '',
    inventoryType: 'all',
    hcwId: 'all',
  });

  useEffect(() => {
    setDateFrom(initialFrom || '');
    setDateTo(initialTo || '');
    setApplied((prev) => ({
      ...prev,
      dateFrom: initialFrom || '',
      dateTo: initialTo || '',
    }));
  }, [initialFrom, initialTo]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (applied.dateFrom) params.set('dateFrom', applied.dateFrom);
      if (applied.dateTo) params.set('dateTo', applied.dateTo);
      if (applied.inventoryType && applied.inventoryType !== 'all') {
        params.set('inventoryType', applied.inventoryType);
      }
      if (applied.hcwId && applied.hcwId !== 'all') params.set('hcwId', applied.hcwId);
      const qs = params.toString();
      const res = await api(`/logistics/dashboard${qs ? `?${qs}` : ''}`);
      setData(res.data || EMPTY);
    } catch (e) {
      setError(e.message);
      setData(EMPTY);
    } finally {
      setBusy(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  const submitFilters = (e) => {
    e?.preventDefault?.();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('From date must be on or before To date');
      return;
    }
    setApplied({ dateFrom, dateTo, inventoryType, hcwId });
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setInventoryType('all');
    setHcwId('all');
    setApplied({ dateFrom: '', dateTo: '', inventoryType: 'all', hcwId: 'all' });
    setError('');
  };

  const k = data.kpis || {};
  const m = metric;
  const focusedCustodian =
    applied.hcwId !== 'all'
      ? (data.filters?.hcws || []).find((custodian) => String(custodian.id) === String(applied.hcwId))
      : null;

  const row1 = [
    { label: 'Goods Receipt', value: m === 'amount' ? k.inwardAmount : k.inwardQty, tone: 'in' },
    { label: 'Goods Issue', value: m === 'amount' ? k.outwardAmount : k.outwardQty, tone: 'out' },
    { label: 'Balance', value: m === 'amount' ? k.balanceAmount : k.balanceQty, tone: 'balance' },
  ];
  const row2 = [
    { label: 'Used', value: m === 'amount' ? k.usedAmount : k.usedQty, tone: 'used' },
    { label: 'Wastage', value: m === 'amount' ? k.wastageAmount : k.wastageQty, tone: 'waste' },
    {
      label: 'Field Balance',
      value: m === 'amount' ? k.fieldBalanceAmount : k.fieldBalanceQty,
      tone: 'field',
    },
  ];
  const row3 = [
    { label: 'Safe', value: m === 'amount' ? k.safeAmount : k.safeQty, tone: 'safe' },
    { label: 'Caution', value: m === 'amount' ? k.cautionAmount : k.cautionQty, tone: 'caution' },
    { label: 'Critical', value: m === 'amount' ? k.criticalAmount : k.criticalQty, tone: 'critical' },
    { label: 'Expired', value: m === 'amount' ? k.expiredAmount : k.expiredQty, tone: 'expired' },
  ];

  const metricToggle = (
    <div className="ilog-dash-metric-field">
      <div className="ilog-dash-metric" role="group" aria-label="Quantity or amount">
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
    </div>
  );

  return (
    <div className={`ilog-hub${embedded ? ' ilog-hub--embedded' : ''}`}>
      <section className="ilog-dash" aria-busy={busy}>
        {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}

        {embedded ? (
          <OpsReviewSlot
            totalLabel="Total movements"
            totalValue={Number(k.inwardQty || 0) + Number(k.outwardQty || 0)}
          >
            <label className="ops-review-header__filter">
              <span>Product category</span>
              <AdaptiveSelect
                id="ilog-inv"
                value={inventoryType}
                onChange={(e) => {
                  const next = e.target.value;
                  setInventoryType(next);
                  setApplied((prev) => ({ ...prev, inventoryType: next }));
                }}
              >
                <option value="all">All categories</option>
                {(data.filters?.inventoryTypes || []).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </AdaptiveSelect>
            </label>
            <label className="ops-review-header__filter">
              <span>Custodian / HCW</span>
              <AdaptiveSelect
                id="ilog-hcw"
                value={hcwId}
                onChange={(e) => {
                  const next = e.target.value;
                  setHcwId(next);
                  setApplied((prev) => ({ ...prev, hcwId: next }));
                }}
              >
                <option value="all">All custodians</option>
                {(data.filters?.hcws || []).map((hcw) => (
                  <option key={hcw.id} value={hcw.id}>
                    {hcw.id}
                    {hcw.name && hcw.name !== hcw.id ? `: ${hcw.name}` : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </label>
            <label className="ops-review-header__filter">
              <span>Display</span>
              <AdaptiveSelect
                aria-label="Display metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="quantity">Quantity</option>
                <option value="amount">Amount</option>
              </AdaptiveSelect>
            </label>
          </OpsReviewSlot>
        ) : (
          <div className="ilog-dash-toolbar">
            <DateRangeFilter
              className="ilog-dash-filters"
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              onSubmit={submitFilters}
              onClear={clearFilters}
              submitting={busy}
            >
              <div className="date-range-filter-field">
                <label htmlFor="ilog-inv">Product category</label>
                <AdaptiveSelect
                  id="ilog-inv"
                  value={inventoryType}
                  onChange={(e) => setInventoryType(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {(data.filters?.inventoryTypes || []).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="date-range-filter-field">
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
                      {hcw.name && hcw.name !== hcw.id ? `: ${hcw.name}` : ''}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
            </DateRangeFilter>
            {metricToggle}
          </div>
        )}

        <div className="ilog-dash-body">
          <div className="ilog-kpi-sections">
            <KpiGroup title="Inventory flow" items={row1} metric={m} />
            <KpiGroup title="Field usage" items={row2} metric={m} />
            <KpiGroup title="Expiry health" items={row3} metric={m} columns={4} />
          </div>

          <section className="ilog-dash-panel ilog-dash-panel--map">
            <header className="ilog-dash-panel-head">
              <h3>Locations &amp; routes</h3>
              <p>Destination volume and goods-issue routes</p>
            </header>
            <MovementLocationPreview
              cities={data.byCity || []}
              routes={data.routes || []}
              metric={metric}
              focusedCustodian={focusedCustodian}
            />
          </section>
        </div>
      </section>
    </div>
  );
}
