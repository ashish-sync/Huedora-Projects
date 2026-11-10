import { useEffect, useId, useMemo, useState } from 'react';

const CHART_TONES = 7;

const CHART_META = {
  requestTimeline: { title: 'Request Timeline' },
  finalBilling: { title: 'Final Billing' },
  punctuality: { title: 'Punctuality Analysis' },
  extraHours: { title: 'Extra Hours' },
  executedClinics: { title: 'Executed Clinics' },
  tyloCancellation: { title: 'Tylo Cancellation' },
};

const HERO_META = [
  { key: 'camps', label: 'Camp Count', field: 'campCount', fallback: 'total' },
  { key: 'patients', label: 'Patients Screened', field: 'patientsScreened' },
  { key: 'doctors', label: 'Unique Doctor', field: 'uniqueDoctors' },
];

/** Row 1 then row 2 — three cards per row. */
const PANEL_ORDER = [
  'requestTimeline',
  'finalBilling',
  'extraHours',
  'punctuality',
  'executedClinics',
  'tyloCancellation',
];

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function normalizeSlices(slices = []) {
  const total = slices.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  return {
    total,
    rows: slices
      .map((row, index) => {
        const value = Number(row.value) || 0;
        const pct = total > 0
          ? Math.round((row.pct != null ? Number(row.pct) : (value / total) * 100))
          : 0;
        return {
          label: row.label,
          value,
          pct,
          tone: index % CHART_TONES,
        };
      })
      .filter((row) => row.value > 0),
  };
}

export function ClientOneMetricPanel({
  chartKey,
  title,
  slices = [],
  emptyText = 'No data',
}) {
  const { total, rows } = useMemo(() => normalizeSlices(slices), [slices]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const headingId = useId();
  const maxValue = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.value), 0),
    [rows],
  );
  const showPct = chartKey !== 'tyloCancellation';

  useEffect(() => {
    setSelectedLabel('');
  }, [slices]);

  return (
    <article className="c1-kpi-card" data-chart={chartKey} aria-labelledby={headingId}>
      <header className="c1-kpi-card__head">
        <h3 className="c1-kpi-card__title" id={headingId}>{title}</h3>
        <span className="c1-kpi-card__total" title="Total records in this metric">
          {formatCount(total)}
        </span>
      </header>

      {total <= 0 ? (
        <div className="c1-kpi-card__empty">{emptyText}</div>
      ) : (
        <ul className="c1-bar-list" aria-label={`${title} breakdown`}>
          {rows.map((row) => {
            const selected = selectedLabel === row.label;
            const muted = selectedLabel && !selected;
            const widthPct = maxValue > 0
              ? Math.max(4, Math.round((row.value / maxValue) * 100))
              : 0;
            return (
              <li key={row.label}>
                <button
                  type="button"
                  className={`c1-bar-row${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}`}
                  onClick={() => setSelectedLabel((prev) => (prev === row.label ? '' : row.label))}
                  aria-pressed={selected}
                >
                  <span className="c1-bar-row__meta">
                    <span className="c1-bar-row__label">{row.label}</span>
                    <span className="c1-bar-row__stats">
                      <strong>{formatCount(row.value)}</strong>
                      {showPct ? <em>{row.pct}%</em> : null}
                    </span>
                  </span>
                  <span className="c1-bar-row__track" aria-hidden="true">
                    <span
                      className={`c1-bar-row__fill c1-bar-row__fill--${row.tone}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function LeaderCard({ rank, item }) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
  return (
    <article className={`client-one-leader-card client-one-leader-card--${medal}`}>
      <header>
        <span className="client-one-leader-card__rank" aria-hidden="true">{rank}</span>
        <div>
          <p className="client-one-leader-card__eyebrow">Top {rank}</p>
          <h4>{item.name}</h4>
        </div>
      </header>
      <dl className="client-one-leader-card__facts">
        <div><dt>State</dt><dd>{item.state || '—'}</dd></div>
        <div><dt>Camps</dt><dd>{formatCount(item.camps)}</dd></div>
        <div><dt>Patients</dt><dd>{formatCount(item.patients)}</dd></div>
        <div><dt>Avg / camp</dt><dd>{Number(item.avgPatients || 0).toFixed(1)}</dd></div>
      </dl>
    </article>
  );
}

export function ClientOneLeaderboard({ doctors = [], mrs = [], focus = '' }) {
  const [mode, setMode] = useState('mrs');
  const items = mode === 'doctors' ? doctors : mrs;
  const label = mode === 'doctors' ? "Top DR's" : "Top MR's";

  useEffect(() => {
    if (focus === 'doctors') setMode('doctors');
    if (focus === 'patients') setMode('mrs');
  }, [focus]);

  return (
    <section className="client-one-leaderboard" aria-label={label}>
      <div className="client-one-leaderboard__head">
        <h3 className="client-one-section-title">{label}</h3>
        <div className="client-one-leaderboard__toggle" role="group" aria-label="Leaderboard type">
          <button type="button" className={mode === 'doctors' ? 'is-active' : ''} onClick={() => setMode('doctors')}>
            Top DR&apos;s
          </button>
          <button type="button" className={mode === 'mrs' ? 'is-active' : ''} onClick={() => setMode('mrs')}>
            Top MR&apos;s
          </button>
        </div>
      </div>
      {items.length ? (
        <div className="client-one-leaderboard__grid">
          {items.map((item, index) => (
            <LeaderCard key={`${mode}-${item.name}-${index}`} rank={index + 1} item={item} />
          ))}
        </div>
      ) : (
        <p className="client-one-empty">No leaderboard data for this period.</p>
      )}
    </section>
  );
}

export function ClientOneHeroKpis({ kpis = {}, focus = 'camps', onFocusChange }) {
  return (
    <div className="c1-hero-strip" role="list">
      {HERO_META.map((meta) => {
        const raw = kpis[meta.field] ?? (meta.fallback ? kpis[meta.fallback] : 0);
        const active = focus === meta.key;
        return (
          <button
            key={meta.key}
            type="button"
            role="listitem"
            className={`c1-hero-strip__item${active ? ' is-active' : ''}`}
            onClick={() => onFocusChange?.(meta.key)}
            aria-pressed={active}
          >
            <span>{meta.label}</span>
            <strong>{formatCount(raw)}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function ClientOneDashboardCharts({
  charts = {},
  leaderboards = {},
  focus = 'camps',
}) {
  const panels = PANEL_ORDER.map((key) => [
    key,
    key === 'tyloCancellation'
      ? (charts.tyloCancellation || charts.khplCancelReasons)
      : charts[key],
  ]);

  return (
    <div className="c1-analytics">
      <div className="c1-analytics__grid" aria-label="Programme analytics">
        {panels.map(([key, chart]) => (
          <ClientOneMetricPanel
            key={key}
            chartKey={key}
            title={CHART_META[key].title}
            slices={chart?.slices || []}
          />
        ))}
      </div>

      <ClientOneLeaderboard
        doctors={leaderboards.doctors || []}
        mrs={leaderboards.mrs || []}
        focus={focus}
      />
    </div>
  );
}
