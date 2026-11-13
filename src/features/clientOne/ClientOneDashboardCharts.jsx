import { useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Layers,
  MapPin,
  Stethoscope,
  Tent,
  Timer,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

const CARD_CONFIGS = {
  requestTimeline: {
    title: 'Request Lead Time',
    subtitle: 'Gap between request date and camp date',
    icon: Calendar,
    ensureLabels: ['≥ 5 Days', '< 5 Days'],
    labelMap: {
      '5 or more Days': '≥ 5 Days',
      '5 or more days': '≥ 5 Days',
      '≥ 5 Days': '≥ 5 Days',
      '>= 5 Days': '≥ 5 Days',
      'Less than 5 Days': '< 5 Days',
      'Less than 5 days': '< 5 Days',
      '< 5 Days': '< 5 Days',
    },
    colors: {
      '≥ 5 Days': '#2563EB', // Vibrant Blue
      '< 5 Days': '#60A5FA', // Sky Blue
    },
  },
  extraHours: {
    title: 'Execution Duration',
    subtitle: 'Camp execution by total hours',
    icon: Clock,
    ensureLabels: ['≤ 4 Hours', '4 – 8 Hours', '> 8 Hours'],
    labelMap: {
      'Within 4 hours': '≤ 4 Hours',
      'within 4 hours': '≤ 4 Hours',
      '≤ 4 Hours': '≤ 4 Hours',
      '<= 4 Hours': '≤ 4 Hours',
      'More than 4 hours': '4 – 8 Hours',
      'more than 4 hours': '4 – 8 Hours',
      '4 – 8 Hours': '4 – 8 Hours',
      '4 - 8 Hours': '4 – 8 Hours',
      '4-8 Hours': '4 – 8 Hours',
      '> 8 Hours': '> 8 Hours',
      'More than 8 hours': '> 8 Hours',
      'more than 8 hours': '> 8 Hours',
    },
    colors: {
      '≤ 4 Hours': '#0D9488',   // Deep Teal
      '4 – 8 Hours': '#2DD4BF', // Mint / Aqua
      '> 8 Hours': '#94A3B8',   // Slate
    },
  },
  finalBilling: {
    title: 'Billing Classification',
    subtitle: 'Camp billing by chargeability status',
    icon: Layers,
    ensureLabels: ['Chargeable', 'Planned', 'Non-Chargeable'],
    labelMap: {
      Chargeable: 'Chargeable',
      Planned: 'Planned',
      'Non-Chargeable': 'Non-Chargeable',
      'Non Chargeable': 'Non-Chargeable',
    },
    colors: {
      Chargeable: '#0F766E',       // Dark Teal
      Planned: '#06B6D4',          // Cyan
      'Non-Chargeable': '#94A3B8', // Slate Grey
    },
  },
  executedClinics: {
    title: 'Clinic Outcome',
    subtitle: 'Final status of requested clinics',
    icon: Activity,
    ensureLabels: ['Executed', 'Planned', 'Cancelled by Client', 'Cancelled by Tylo'],
    labelMap: {
      Executed: 'Executed',
      Planned: 'Planned',
      'Cancelled by Client': 'Cancelled by Client',
      'Cancelled by Tylo': 'Cancelled by Tylo',
    },
    colors: {
      Executed: '#2563EB',              // Blue
      Planned: '#38BDF8',               // Sky Blue
      'Cancelled by Client': '#64748B', // Grey-Blue
      'Cancelled by Tylo': '#CBD5E1',   // Light Grey
    },
  },
  punctuality: {
    title: 'Punctuality Performance',
    subtitle: 'Camp punctuality status',
    icon: Timer,
    ensureLabels: ['Good', 'Pending', 'Average', 'Poor', 'Cancelled'],
    labelMap: {
      Good: 'Good',
      Pending: 'Pending',
      Average: 'Average',
      Poor: 'Poor',
      Cancelled: 'Cancelled',
    },
    colors: {
      Good: '#10B981',      // Emerald Green
      Pending: '#6EE7B7',   // Mint / Sage
      Average: '#F59E0B',   // Soft Amber
      Poor: '#94A3B8',      // Neutral Slate
      Cancelled: '#CBD5E1', // Soft Grey
    },
  },
  tyloCancellation: {
    title: 'Tylo Cancellation Reasons',
    subtitle: 'Reasons for camps cancelled by Tylo',
    icon: XCircle,
    ensureLabels: [
      'HCW Unavailability',
      'Equipment Issue',
      'Logistics Delay',
      'Location Issue',
      'Other Reason',
    ],
    labelMap: {
      'HCW Unavailability': 'HCW Unavailability',
      'Equipment Issue': 'Equipment Issue',
      'Logistics Delay': 'Logistics Delay',
      'Location Issue': 'Location Issue',
      'Other Reason': 'Other Reason',
    },
    colors: {
      'HCW Unavailability': '#475569', // Slate Navy
      'Equipment Issue': '#64748B',    // Slate
      'Logistics Delay': '#94A3B8',    // Muted Grey
      'Location Issue': '#CBD5E1',     // Light Grey
      'Other Reason': '#E2E8F0',       // Soft Grey
    },
  },
};

/** Exact 3 × 2 grid order matching reference visual */
const PANEL_ORDER = [
  'requestTimeline',
  'extraHours',
  'finalBilling',
  'executedClinics',
  'punctuality',
  'tyloCancellation',
];

const DEFAULT_FALLBACK_COLORS = [
  '#2563EB',
  '#0D9488',
  '#06B6D4',
  '#F59E0B',
  '#64748B',
  '#94A3B8',
  '#CBD5E1',
];

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function normalizeSlices(chartKey, slices = []) {
  const config = CARD_CONFIGS[chartKey] || {};
  const labelMap = config.labelMap || {};
  const ensureLabels = config.ensureLabels || [];
  const colorMap = config.colors || {};

  // Group incoming values by mapped label
  const valueMap = new Map();
  for (const item of slices) {
    if (!item) continue;
    const rawLabel = String(item.label || '').trim();
    const mapped = labelMap[rawLabel] || rawLabel;
    if (!mapped) continue;
    const val = Number(item.value) || 0;
    valueMap.set(mapped, (valueMap.get(mapped) || 0) + val);
  }

  // Calculate total count
  let total = 0;
  for (const v of valueMap.values()) {
    total += v;
  }

  const rows = [];
  const seenLabels = new Set();

  if (ensureLabels.length > 0) {
    for (const [idx, label] of ensureLabels.entries()) {
      seenLabels.add(label);
      const val = valueMap.get(label) || 0;
      const pct = total > 0 ? Math.round((val / total) * 100) : 0;
      const color = colorMap[label] || DEFAULT_FALLBACK_COLORS[idx % DEFAULT_FALLBACK_COLORS.length];
      rows.push({
        label,
        value: val,
        pct,
        color,
      });
    }

    // Also include any extra labels that were provided in data
    let extraIdx = ensureLabels.length;
    for (const [label, val] of valueMap.entries()) {
      if (!seenLabels.has(label) && val > 0) {
        seenLabels.add(label);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        const color = colorMap[label] || DEFAULT_FALLBACK_COLORS[extraIdx % DEFAULT_FALLBACK_COLORS.length];
        extraIdx += 1;
        rows.push({
          label,
          value: val,
          pct,
          color,
        });
      }
    }
  } else {
    // Standard filtered rows
    let idx = 0;
    for (const [label, val] of valueMap.entries()) {
      if (val > 0) {
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        const color = colorMap[label] || DEFAULT_FALLBACK_COLORS[idx % DEFAULT_FALLBACK_COLORS.length];
        idx += 1;
        rows.push({
          label,
          value: val,
          pct,
          color,
        });
      }
    }
  }

  return { total, rows };
}

/**
 * Pure SVG Donut Chart with center label
 */
export function DonutChart({
  rows = [],
  total = 0,
  unit = 'Camps',
  size = 116,
  strokeWidth = 15,
  selectedLabel = '',
  onSelectLabel,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const activeRows = rows.filter((r) => r.value > 0);

  let accumulated = 0;
  const arcs = activeRows.map((row) => {
    const fraction = total > 0 ? row.value / total : 0;
    const arcLength = fraction * circumference;
    const offset = accumulated;
    accumulated += arcLength;
    return {
      ...row,
      arcLength,
      offset,
    };
  });

  return (
    <div className="c1-donut-chart" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="c1-donut-svg"
        aria-hidden="true"
      >
        {/* Track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />

        {total <= 0 ? null : arcs.length === 1 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arcs[0].color}
            strokeWidth={strokeWidth}
            className={`c1-donut-slice${selectedLabel === arcs[0].label ? ' is-selected' : ''}`}
            onClick={() => onSelectLabel?.(arcs[0].label)}
          />
        ) : (
          <g transform={`rotate(-90 ${center} ${center})`}>
            {arcs.map((arc) => {
              const gap = 2;
              const visualArc = Math.max(0, arc.arcLength - gap);
              const isSelected = selectedLabel === arc.label;
              const isMuted = selectedLabel && !isSelected;
              return (
                <circle
                  key={arc.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                  strokeDasharray={`${visualArc} ${circumference - visualArc}`}
                  strokeDashoffset={-arc.offset}
                  className={`c1-donut-slice${isSelected ? ' is-selected' : ''}${isMuted ? ' is-muted' : ''}`}
                  onClick={() => onSelectLabel?.(arc.label)}
                />
              );
            })}
          </g>
        )}
      </svg>
      <div className="c1-donut-center">
        <span className="c1-donut-count">{formatCount(total)}</span>
        <span className="c1-donut-unit">{total === 1 ? 'Camp' : unit}</span>
      </div>
    </div>
  );
}

export function ClientOneMetricPanel({
  chartKey,
  title: customTitle,
  slices = [],
  emptyText = 'No data',
}) {
  const config = CARD_CONFIGS[chartKey] || {};
  const title = customTitle || config.title || 'Analysis';
  const subtitle = config.subtitle || '';
  const IconComponent = config.icon || Activity;

  const { total, rows } = useMemo(
    () => normalizeSlices(chartKey, slices),
    [chartKey, slices],
  );
  const [selectedLabel, setSelectedLabel] = useState('');
  const headingId = useId();

  useEffect(() => {
    setSelectedLabel('');
  }, [slices]);

  return (
    <article className="c1-kpi-card" data-chart={chartKey} aria-labelledby={headingId}>
      <header className="c1-kpi-card__head">
        <div className="c1-kpi-card__title-wrap">
          <div className="c1-kpi-card__icon" aria-hidden="true">
            <IconComponent size={18} />
          </div>
          <div className="c1-kpi-card__text">
            <h3 className="c1-kpi-card__title" id={headingId}>{title}</h3>
            {subtitle ? <p className="c1-kpi-card__sub">{subtitle}</p> : null}
          </div>
        </div>
        <span className="c1-kpi-card__total" title={`Total: ${formatCount(total)}`}>
          {formatCount(total)}
        </span>
      </header>

      {total <= 0 && rows.length === 0 ? (
        <div className="c1-kpi-card__empty">{emptyText}</div>
      ) : (
        <div className="c1-kpi-card__body">
          <DonutChart
            rows={rows}
            total={total}
            selectedLabel={selectedLabel}
            onSelectLabel={(lbl) => setSelectedLabel((prev) => (prev === lbl ? '' : lbl))}
          />

          <ul className="c1-legend-list" aria-label={`${title} breakdown`}>
            {rows.map((row) => {
              const selected = selectedLabel === row.label;
              const muted = selectedLabel && !selected;
              return (
                <li key={row.label} className="c1-legend-item">
                  <button
                    type="button"
                    className={`c1-legend-btn${selected ? ' is-selected' : ''}${muted ? ' is-muted' : ''}`}
                    onClick={() => setSelectedLabel((prev) => (prev === row.label ? '' : row.label))}
                    aria-pressed={selected}
                  >
                    <span className="c1-legend-left">
                      <span
                        className="c1-legend-dot"
                        style={{ backgroundColor: row.color }}
                        aria-hidden="true"
                      />
                      <span className="c1-legend-label" title={row.label}>{row.label}</span>
                    </span>
                    <span className="c1-legend-stats">
                      <strong className="c1-legend-val">{formatCount(row.value)}</strong>
                      <span className="c1-legend-pct">({row.pct}%)</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

function SparklineWave({ color = '#60A5FA' }) {
  return (
    <svg
      viewBox="0 0 100 36"
      className="c1-hero-sparkline"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M 2 28 C 22 28, 30 14, 48 20 C 66 26, 75 10, 98 8"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClientOneHeroKpis({ kpis = {}, focus = 'camps', onFocusChange }) {
  const campCount = Number(kpis.campCount ?? kpis.total ?? 0);
  const executed = Number(kpis.executed ?? 0);
  const pending = Number(kpis.pending ?? 0);
  const cancelled = Number(kpis.cancelled ?? 0);
  const patientsScreened = Number(kpis.patientsScreened ?? 0);
  const uniqueDoctors = Number(kpis.uniqueDoctors ?? 0);

  const avgPatientsPerCamp = campCount > 0 ? (patientsScreened / campCount).toFixed(1) : '0.0';

  const cards = [
    {
      key: 'camps',
      label: 'Camp Count',
      value: campCount,
      icon: Tent,
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      trend: '+12%',
      sparkColor: '#60A5FA',
      subtitle: `${executed} Executed · ${pending} Planned · ${cancelled} Cancelled`,
    },
    {
      key: 'patients',
      label: 'Patients Screened',
      value: patientsScreened,
      icon: Users,
      iconBg: '#ECFDF5',
      iconColor: '#0D9488',
      trend: '+18%',
      sparkColor: '#34D399',
      subtitle: `${avgPatientsPerCamp} Avg / Camp`,
    },
    {
      key: 'doctors',
      label: 'Unique Doctor',
      value: uniqueDoctors,
      icon: Stethoscope,
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      trend: '+8%',
      sparkColor: '#60A5FA',
      subtitle: 'Active Specialist Reach',
    },
  ];

  return (
    <div className="c1-hero-strip" role="list">
      {cards.map((card) => {
        const active = focus === card.key;
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            type="button"
            role="listitem"
            className={`c1-hero-card${active ? ' is-active' : ''}`}
            onClick={() => onFocusChange?.(card.key)}
            aria-pressed={active}
          >
            <div className="c1-hero-card__top">
              <div
                className="c1-hero-card__icon"
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                aria-hidden="true"
              >
                <Icon size={22} />
              </div>

              <div className="c1-hero-card__metric">
                <span className="c1-hero-card__label">{card.label}</span>
                <div className="c1-hero-card__val-row">
                  <strong className="c1-hero-card__val">{formatCount(card.value)}</strong>
                  <span className="c1-hero-card__trend" aria-label={`Trend ${card.trend}`}>
                    <span className="c1-hero-card__arrow">↑</span> {card.trend}
                  </span>
                </div>
              </div>

              <div className="c1-hero-card__chart-slot">
                <SparklineWave color={card.sparkColor} />
              </div>
            </div>

            <p className="c1-hero-card__sub">{card.subtitle}</p>
          </button>
        );
      })}
    </div>
  );
}

function LeaderCard({ rank, item }) {
  const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : 'rank-3';
  return (
    <article className={`c1-field-card c1-field-card--${rankClass}`}>
      <header className="c1-field-card__head">
        <span className="c1-field-card__rank" aria-label={`Rank ${rank}`}>{rank}</span>
        <h4 className="c1-field-card__name" title={item.name}>{item.name}</h4>
      </header>

      <div className="c1-field-card__facts">
        <div className="c1-field-card__fact">
          <span className="c1-field-card__fact-label">
            <MapPin size={12} className="c1-fact-icon" aria-hidden="true" /> State
          </span>
          <span className="c1-field-card__fact-val">{item.state || '—'}</span>
        </div>

        <div className="c1-field-card__fact">
          <span className="c1-field-card__fact-label">
            <Tent size={12} className="c1-fact-icon" aria-hidden="true" /> Camps
          </span>
          <span className="c1-field-card__fact-val">{formatCount(item.camps)}</span>
        </div>

        <div className="c1-field-card__fact">
          <span className="c1-field-card__fact-label">
            <Users size={12} className="c1-fact-icon" aria-hidden="true" /> Patients
          </span>
          <span className="c1-field-card__fact-val">{formatCount(item.patients)}</span>
        </div>

        <div className="c1-field-card__fact">
          <span className="c1-field-card__fact-label">
            <BarChart3 size={12} className="c1-fact-icon" aria-hidden="true" /> Avg / Camp
          </span>
          <span className="c1-field-card__fact-val">{Number(item.avgPatients || 0).toFixed(1)}</span>
        </div>
      </div>
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
    <section className="c1-field-performance" aria-label="Field Performance">
      <div className="c1-field-performance__head">
        <div className="c1-field-performance__title-row">
          <Users size={20} className="c1-field-title-icon" aria-hidden="true" />
          <h3 className="c1-field-performance__title">{label}</h3>
        </div>

        <div className="c1-field-toggle" role="group" aria-label="Leaderboard type">
          <button
            type="button"
            className={mode === 'doctors' ? 'is-active' : ''}
            onClick={() => setMode('doctors')}
            aria-pressed={mode === 'doctors'}
          >
            Top DR&apos;s
          </button>
          <button
            type="button"
            className={mode === 'mrs' ? 'is-active' : ''}
            onClick={() => setMode('mrs')}
            aria-pressed={mode === 'mrs'}
          >
            Top MR&apos;s
          </button>
        </div>
      </div>

      {items.length ? (
        <div className="c1-field-grid">
          {items.slice(0, 3).map((item, index) => (
            <LeaderCard key={`${mode}-${item.name}-${index}`} rank={index + 1} item={item} />
          ))}
        </div>
      ) : (
        <p className="c1-empty-state">No leaderboard data available for this date range.</p>
      )}
    </section>
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
      <div className="c1-section-header">
        <div className="c1-section-header__title-group">
          <BarChart3 size={20} className="c1-section-icon" aria-hidden="true" />
          <h2 className="c1-section-title">Camp Operations Analysis</h2>
        </div>
      </div>

      <div className="c1-analytics__grid" aria-label="Camp Operations Analysis">
        {panels.map(([key, chart]) => (
          <ClientOneMetricPanel
            key={key}
            chartKey={key}
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
