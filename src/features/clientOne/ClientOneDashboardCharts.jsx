import { useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Layers,
  Stethoscope,
  Tent,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';
import { CANCELLED_BY_TYLO_REASON_LABELS } from '../camps/constants/campClosure';

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
      '≥ 5 Days': '#2563EB',
      '< 5 Days': '#60A5FA',
    },
  },
  extraHours: {
    title: 'Execution Duration',
    subtitle: 'Camp execution by total hours',
    icon: Clock,
    ensureLabels: ['Within 4 hours', 'More than 4 hours'],
    labelMap: {
      'Within 4 hours': 'Within 4 hours',
      'within 4 hours': 'Within 4 hours',
      '≤ 4 Hours': 'Within 4 hours',
      '<= 4 Hours': 'Within 4 hours',
      'More than 4 hours': 'More than 4 hours',
      'more than 4 hours': 'More than 4 hours',
      'Beyond 4 Hours': 'More than 4 hours',
    },
    colors: {
      'Within 4 hours': 'var(--accent-primary, #2563EB)',
      'More than 4 hours': 'var(--text-muted, #94A3B8)',
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
      Chargeable: '#0F766E',
      Planned: '#06B6D4',
      'Non-Chargeable': '#94A3B8',
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
      Executed: '#2563EB',
      Planned: '#38BDF8',
      'Cancelled by Client': '#64748B',
      'Cancelled by Tylo': '#CBD5E1',
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
      Good: '#10B981',
      Pending: '#6EE7B7',
      Average: '#F59E0B',
      Poor: '#94A3B8',
      Cancelled: '#CBD5E1',
    },
  },
  tyloCancellation: {
    title: 'Tylo Cancellation Reasons',
    subtitle: 'Reasons for camps cancelled by Tylo',
    icon: XCircle,
    ensureLabels: [...CANCELLED_BY_TYLO_REASON_LABELS],
    strictLabels: true,
    labelMap: {
      ...Object.fromEntries(
        CANCELLED_BY_TYLO_REASON_LABELS.map((label) => [label, label]),
      ),
      'HCW Unavailability': 'Resource Issue',
      'HCW Backout': 'Resource Issue',
      Punctuality: 'Operational Issue',
      'Compliance & Knowledge': 'Operational Issue',
      'Grooming Issue': 'Operational Issue',
      'Device Failure': 'Device & Inventory',
      'Inventory Shortage': 'Device & Inventory',
      'Missing Consumables': 'Device & Inventory',
      'Equipment Issue': 'Device & Inventory',
      'Adverse Weather': 'External Factors',
      'Force Majeure': 'External Factors',
      'Other (Mandatory Remarks)': 'Other',
      'Other Reason': 'Other',
      'Logistics Delay': 'Other',
      'Location Issue': 'Other',
      Unspecified: 'Other',
    },
    colors: {
      'Resource Issue': '#475569',
      'Operational Issue': '#64748B',
      'Device & Inventory': '#94A3B8',
      'External Factors': '#CBD5E1',
      Other: '#E2E8F0',
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
  const strictLabels = Boolean(config.strictLabels);
  const fallbackOther = ensureLabels.includes('Other')
    ? 'Other'
    : (ensureLabels[ensureLabels.length - 1] || '');

  const valueMap = new Map();
  for (const item of slices) {
    if (!item) continue;
    const rawLabel = String(item.label || '').trim();
    let mapped = labelMap[rawLabel] || rawLabel;
    if (strictLabels && ensureLabels.length > 0 && mapped && !ensureLabels.includes(mapped)) {
      mapped = fallbackOther;
    }
    if (!mapped) continue;
    const val = Number(item.value) || 0;
    valueMap.set(mapped, (valueMap.get(mapped) || 0) + val);
  }

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

    if (!strictLabels) {
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
    }
  } else {
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
  size = 88,
  strokeWidth = 12,
  selectedLabel = '',
  onSelectLabel,
  onDrillDown,
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
    <div
      className="c1-donut-chart"
      style={{ width: size, height: size, cursor: onDrillDown ? 'pointer' : 'default' }}
      title={onDrillDown ? 'Click to drill down into records' : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="c1-donut-svg"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border-default, #D4DDE8)"
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
            onClick={(e) => {
              e.stopPropagation();
              onSelectLabel?.(arcs[0].label);
              onDrillDown?.(arcs[0].label);
            }}
          />
        ) : (
          <g transform={`rotate(-90 ${center} ${center})`}>
            {arcs.map((arc) => {
              const gap = 1.5;
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
                  strokeWidth={isSelected ? strokeWidth + 1.5 : strokeWidth}
                  strokeDasharray={`${visualArc} ${circumference - visualArc}`}
                  strokeDashoffset={-arc.offset}
                  className={`c1-donut-slice${isSelected ? ' is-selected' : ''}${isMuted ? ' is-muted' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLabel?.(arc.label);
                    onDrillDown?.(arc.label);
                  }}
                />
              );
            })}
          </g>
        )}
      </svg>
      <div
        className="c1-donut-center"
        onClick={() => onDrillDown?.('All')}
        role={onDrillDown ? 'button' : undefined}
        tabIndex={onDrillDown ? 0 : undefined}
        aria-label={onDrillDown ? `Drill down into ${total} ${unit}` : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDrillDown?.('All');
          }
        }}
      >
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
  onDrillDown,
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

  const handleDrillDown = (lbl) => {
    onDrillDown?.({
      source: 'chart',
      key: chartKey,
      label: lbl || 'All',
      title: lbl && lbl !== 'All' ? `${title}: ${lbl}` : `${title}`,
      subtitle,
    });
  };

  return (
    <article className="c1-kpi-card" data-chart={chartKey} aria-labelledby={headingId}>
      <header
        className="c1-kpi-card__head"
        onClick={() => onDrillDown && handleDrillDown('All')}
        style={{ cursor: onDrillDown ? 'pointer' : 'default' }}
        title={onDrillDown ? `Click to drill down into all ${title} records` : undefined}
      >
        <div className="c1-kpi-card__title-wrap">
          <div className="c1-kpi-card__icon" aria-hidden="true">
            <IconComponent size={14} strokeWidth={1.75} />
          </div>
          <div className="c1-kpi-card__text">
            <h3 className="c1-kpi-card__title" id={headingId}>{title}</h3>
            {subtitle ? <p className="c1-kpi-card__sub">{subtitle}</p> : null}
          </div>
        </div>
        <span className="c1-kpi-card__total" title={`Total: ${formatCount(total)} (Click to drill down)`}>
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
            onDrillDown={onDrillDown ? (lbl) => handleDrillDown(lbl) : undefined}
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
                    onClick={() => {
                      setSelectedLabel((prev) => (prev === row.label ? '' : row.label));
                      handleDrillDown(row.label);
                    }}
                    aria-pressed={selected}
                    title={`Click to drill down into ${row.label} records`}
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

export function ClientOneHeroKpis({
  kpis = {},
  focus = 'camps',
  onFocusChange,
  onDrillDown,
}) {
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
      label: 'Total Camps',
      value: campCount,
      icon: Tent,
      tone: 'camps',
      chips: [
        { label: 'Executed', value: executed, tone: 'executed' },
        { label: 'Planned', value: pending, tone: 'planned' },
        { label: 'Cancelled', value: cancelled, tone: 'cancelled' },
      ],
    },
    {
      key: 'patients',
      label: 'Patients Screened',
      value: patientsScreened,
      icon: Users,
      tone: 'patients',
      subtitle: `${avgPatientsPerCamp} Avg / Camp`,
    },
    {
      key: 'doctors',
      label: 'Unique Doctors',
      value: uniqueDoctors,
      icon: Stethoscope,
      tone: 'doctors',
      subtitle: 'Active specialist reach',
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
            onClick={() => {
              onFocusChange?.(card.key);
              onDrillDown?.({
                source: 'hero',
                key: card.key,
                label: 'All',
                title: card.label === 'Total Camps' ? 'Camp Count' : card.label,
                subtitle: card.subtitle || 'All camps in selected period',
              });
            }}
            aria-pressed={active}
            title={`Click to drill down into ${card.label}`}
          >
            <div className="c1-hero-card__top">
              <div
                className={`c1-hero-card__icon c1-hero-card__icon--${card.tone}`}
                aria-hidden="true"
              >
                <Icon size={16} strokeWidth={1.75} />
              </div>

              <div className="c1-hero-card__metric">
                <span className="c1-hero-card__label">{card.label}</span>
                <strong className="c1-hero-card__val">{formatCount(card.value)}</strong>
              </div>
            </div>

            {card.chips ? (
              <ul className="c1-hero-card__chips" aria-label="Camp status breakdown">
                {card.chips.map((chip) => (
                  <li
                    key={chip.label}
                    className={`c1-hero-chip c1-hero-chip--${chip.tone}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusChange?.('camps');
                      onDrillDown?.({
                        source: 'hero',
                        key: 'camps',
                        label: chip.label,
                        title: `Camp Count (${chip.label})`,
                        subtitle: `${formatCount(chip.value)} ${chip.label.toLowerCase()} camps in period`,
                      });
                    }}
                    title={`Click to drill down into ${chip.label} camps`}
                  >
                    <span className="c1-hero-chip__dot" aria-hidden="true" />
                    <span className="c1-hero-chip__val">{formatCount(chip.value)}</span>
                    <span className="c1-hero-chip__label">{chip.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="c1-hero-card__sub">{card.subtitle}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ClientOneLeaderboard({
  doctors = [],
  mrs = [],
  focus = '',
  onDrillDown,
}) {
  const [mode, setMode] = useState('mrs');
  const items = mode === 'doctors' ? doctors : mrs;
  const nameHeader = mode === 'doctors' ? 'Doctor' : 'Medical Representative';
  const rows = items.slice(0, 5);
  const maxAvg = Math.max(...rows.map((item) => Number(item.avgPatients) || 0), 1);

  useEffect(() => {
    if (focus === 'doctors') setMode('doctors');
    if (focus === 'patients') setMode('mrs');
  }, [focus]);

  return (
    <section className="c1-field-performance" aria-label="Top Performers">
      <div className="c1-field-performance__head">
        <div className="c1-field-performance__title-row">
          <Users size={16} className="c1-field-title-icon" aria-hidden="true" />
          <h3 className="c1-field-performance__title">Top Performers</h3>
        </div>

        <div className="c1-field-toggle" role="group" aria-label="Leaderboard type">
          <button
            type="button"
            className={mode === 'mrs' ? 'is-active' : ''}
            onClick={() => setMode('mrs')}
            aria-pressed={mode === 'mrs'}
          >
            Top MRs
          </button>
          <button
            type="button"
            className={mode === 'doctors' ? 'is-active' : ''}
            onClick={() => setMode('doctors')}
            aria-pressed={mode === 'doctors'}
          >
            Top DRs
          </button>
        </div>
      </div>

      {rows.length ? (
        <div className="c1-perf-table-wrap">
          <table className="c1-perf-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">{nameHeader}</th>
                <th scope="col">State</th>
                <th scope="col">Camps</th>
                <th scope="col">Patients</th>
                <th scope="col">Avg / Camp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const rank = index + 1;
                const avg = Number(item.avgPatients) || 0;
                const barPct = Math.max(6, Math.round((avg / maxAvg) * 100));
                return (
                  <tr
                    key={`${mode}-${item.name}-${index}`}
                    onClick={() =>
                      onDrillDown?.({
                        source: 'performer',
                        mode,
                        name: item.name,
                        item,
                        title: `${mode === 'doctors' ? 'Doctor' : 'Medical Representative'}: ${item.name}`,
                        subtitle: `${formatCount(item.camps)} Camps · ${formatCount(item.patients)} Patients · ${item.state || '—'}`,
                      })
                    }
                    className="c1-perf-row--interactive"
                    style={{ cursor: onDrillDown ? 'pointer' : 'default' }}
                    title={onDrillDown ? `Click to drill down into camps for ${item.name}` : undefined}
                  >
                    <td>
                      <span className={`c1-perf-rank c1-perf-rank--${rank}`} aria-label={`Rank ${rank}`}>
                        {String(rank).padStart(2, '0')}
                      </span>
                    </td>
                    <td>
                      <span className="c1-perf-name" title={item.name}>{item.name}</span>
                    </td>
                    <td>{item.state || '—'}</td>
                    <td className="c1-perf-num">{formatCount(item.camps)}</td>
                    <td className="c1-perf-num">{formatCount(item.patients)}</td>
                    <td>
                      <div className="c1-perf-avg">
                        <span className="c1-perf-num">{avg.toFixed(1)}</span>
                        <span className="c1-perf-bar" aria-hidden="true">
                          <span className="c1-perf-bar__fill" style={{ width: `${barPct}%` }} />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  onDrillDown,
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
          <BarChart3 size={16} className="c1-section-icon" aria-hidden="true" />
          <h2 className="c1-section-title">Camp Operations Analysis</h2>
        </div>
      </div>

      <div className="c1-analytics__grid" aria-label="Camp Operations Analysis">
        {panels.map(([key, chart]) => (
          <ClientOneMetricPanel
            key={key}
            chartKey={key}
            slices={chart?.slices || []}
            onDrillDown={onDrillDown}
          />
        ))}
      </div>

      <ClientOneLeaderboard
        doctors={leaderboards.doctors || []}
        mrs={leaderboards.mrs || []}
        focus={focus}
        onDrillDown={onDrillDown}
      />
    </div>
  );
}
