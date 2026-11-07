import { useEffect, useId, useMemo, useRef, useState } from 'react';
import DateInput from '../../components/ui/DateInput.jsx';
import { api } from '../../shared/api.js';
import { parseToDate } from '../../shared/dateFormat.js';
import { getDefaultMonthDateRange, toDateInputValue } from '../camps/utils/dateRange.js';

export const WELCOME_METRIC_OPTIONS = [
  { id: 'punctuality', label: 'Punctuality' },
  { id: 'attire', label: 'Attire Compliance' },
  { id: 'chargeability', label: 'Chargeability' },
  { id: 'campCycle', label: 'Avg. Camp Cycle' },
  { id: 'avgPayout', label: 'Avg. Payout' },
];

function formatCompactRangeLabel(from, to) {
  const fromDate = parseToDate(from);
  const toDate = parseToDate(to);
  if (!fromDate || !toDate) return 'Select dates';

  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit' });
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });
  const full = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const currentYear = new Date().getFullYear();

  if (fromDate.getTime() === toDate.getTime()) {
    return fromDate.getFullYear() === currentYear
      ? dayMonth.format(fromDate)
      : full.format(fromDate);
  }

  const sameMonth =
    fromDate.getFullYear() === toDate.getFullYear()
    && fromDate.getMonth() === toDate.getMonth();
  if (sameMonth) {
    if (toDate.getFullYear() === currentYear) {
      return `${day.format(fromDate)}–${dayMonth.format(toDate)}`;
    }
    return `${day.format(fromDate)}–${full.format(toDate)}`;
  }

  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  if (sameYear) {
    if (toDate.getFullYear() === currentYear) {
      return `${dayMonth.format(fromDate)}–${dayMonth.format(toDate)}`;
    }
    return `${dayMonth.format(fromDate)}–${full.format(toDate)}`;
  }

  return `${full.format(fromDate)}–${full.format(toDate)}`;
}

export function welcomeBucketTone(key) {
  switch (String(key || '').trim()) {
    case 'Good':
    case 'No Issue':
    case 'Chargeable':
      return 'ok';
    case 'Average':
    case 'Non-Chargeable':
      return 'warn';
    case 'Poor':
    case 'Issue':
    case 'Cancelled':
      return 'danger';
    case 'Amount':
      return 'info';
    case 'Yet to Update':
    default:
      return 'neutral';
  }
}

function formatAmount(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function WelcomeMetrics({ enabled = true }) {
  const defaultRange = useMemo(() => getDefaultMonthDateRange(), []);
  const [draftFrom, setDraftFrom] = useState(defaultRange.dateFrom);
  const [draftTo, setDraftTo] = useState(defaultRange.dateTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultRange.dateFrom);
  const [appliedTo, setAppliedTo] = useState(defaultRange.dateTo);
  const [metric, setMetric] = useState('punctuality');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);
  const metricSelectId = useId();

  useEffect(() => {
    if (!enabled) {
      setPayload(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      metric,
      from: appliedFrom,
      to: appliedTo,
    });

    api(`/dashboards/camp-quality?${query.toString()}`)
      .then((response) => {
        if (!current) return;
        if (!response?.data || !Array.isArray(response.data.buckets)) {
          throw new Error('Invalid camp quality response.');
        }
        setPayload(response.data);
      })
      .catch((err) => {
        if (!current) return;
        setPayload(null);
        setError(err?.message || 'Unable to load metric data.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [enabled, metric, appliedFrom, appliedTo]);

  useEffect(() => {
    if (!rangeOpen) return undefined;

    function handlePointerDown(event) {
      const target = event.target;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setRangeOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setRangeOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [rangeOpen]);

  const rangeLabel = formatCompactRangeLabel(appliedFrom, appliedTo);
  const metricLabel = WELCOME_METRIC_OPTIONS.find((option) => option.id === metric)?.label || 'Metric';

  function applyRange() {
    const from = draftFrom || toDateInputValue(new Date());
    const to = draftTo || from;
    const orderedFrom = from <= to ? from : to;
    const orderedTo = from <= to ? to : from;
    setDraftFrom(orderedFrom);
    setDraftTo(orderedTo);
    setAppliedFrom(orderedFrom);
    setAppliedTo(orderedTo);
    setRangeOpen(false);
  }

  function clearRange() {
    const next = getDefaultMonthDateRange();
    setDraftFrom(next.dateFrom);
    setDraftTo(next.dateTo);
    setAppliedFrom(next.dateFrom);
    setAppliedTo(next.dateTo);
    setRangeOpen(false);
  }

  return (
    <div className="tylo-home-welcome-metrics">
      <div className="tylo-home-welcome-controls">
        <div className="tylo-home-welcome-range">
          <button
            ref={triggerRef}
            type="button"
            className="tylo-home-welcome-control"
            aria-haspopup="dialog"
            aria-expanded={rangeOpen}
            aria-label={`Date range ${rangeLabel}`}
            title={rangeLabel}
            onClick={() => {
              setDraftFrom(appliedFrom);
              setDraftTo(appliedTo);
              setRangeOpen((open) => !open);
            }}
          >
            <span className="tylo-home-welcome-control-icon" aria-hidden="true">
              <CalendarGlyph />
            </span>
            <span className="tylo-home-welcome-control-label">{rangeLabel}</span>
            <span className="tylo-dropdown-chevron tylo-home-welcome-control-chevron" aria-hidden="true" />
          </button>

          {rangeOpen ? (
            <div
              ref={popoverRef}
              className="tylo-home-welcome-range-popover"
              role="dialog"
              aria-label="Choose date range"
            >
              <div className="tylo-home-welcome-range-fields">
                <label className="tylo-home-welcome-range-field">
                  <span>From</span>
                  <DateInput
                    hideLabel
                    aria-label="From date"
                    value={draftFrom}
                    max={draftTo || undefined}
                    onChange={setDraftFrom}
                  />
                </label>
                <label className="tylo-home-welcome-range-field">
                  <span>To</span>
                  <DateInput
                    hideLabel
                    aria-label="To date"
                    value={draftTo}
                    min={draftFrom || undefined}
                    onChange={setDraftTo}
                  />
                </label>
              </div>
              <div className="tylo-home-welcome-range-actions">
                <button type="button" className="btn btn-compact" onClick={applyRange}>
                  Apply
                </button>
                <button type="button" className="btn secondary btn-compact" onClick={clearRange}>
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <label className="tylo-home-welcome-metric" htmlFor={metricSelectId}>
          <span className="sr-only">Metric</span>
          <select
            id={metricSelectId}
            className="tylo-home-welcome-control tylo-home-welcome-metric-select"
            value={metric}
            title={metricLabel}
            aria-label="Camp quality metric"
            onChange={(event) => setMetric(event.target.value)}
          >
            {WELCOME_METRIC_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tylo-home-welcome-metric-body" aria-live="polite">
        {loading ? (
          <p className="tylo-home-welcome-metric-status">Loading {metricLabel.toLowerCase()}…</p>
        ) : null}
        {!loading && error ? (
          <p className="tylo-home-welcome-metric-status tylo-home-welcome-metric-status--error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && payload ? (
          <div className="tylo-home-welcome-buckets" role="list" aria-label={`${payload.label || metricLabel} breakdown`}>
            {payload.buckets.map((bucket) => {
              const isAmount = metric === 'avgPayout' && bucket.key === 'Amount';
              const value = isAmount
                ? formatAmount(payload.summary?.averageAmount)
                : String(bucket.count ?? 0);
              const hint = isAmount
                ? `${bucket.count || 0} camp${bucket.count === 1 ? '' : 's'}`
                : null;
              const tone = welcomeBucketTone(bucket.key);
              return (
                <div
                  key={bucket.key}
                  className={`tylo-home-welcome-bucket tylo-home-welcome-bucket--${tone}`}
                  role="listitem"
                >
                  <span className="tylo-home-welcome-bucket-value">{value}</span>
                  <span className="tylo-home-welcome-bucket-label">{bucket.key}</span>
                  {hint ? <span className="tylo-home-welcome-bucket-hint">{hint}</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
