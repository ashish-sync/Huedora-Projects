import { useEffect, useId, useMemo, useState } from 'react';
import DateInput from '../../components/ui/DateInput.jsx';
import { api } from '../../shared/api.js';
import { getWelcomeDefaultDateRange, toDateInputValue } from '../camps/utils/dateRange.js';

export const WELCOME_METRIC_OPTIONS = [
  { id: 'punctuality', label: 'Punctuality' },
  { id: 'attire', label: 'Attire Compliance' },
  { id: 'chargeability', label: 'Chargeability' },
  { id: 'campCycle', label: 'Avg. Camp Cycle' },
  { id: 'avgPayout', label: 'Avg. Payout' },
];

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

function ClearGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export default function WelcomeMetrics({ enabled = true }) {
  const defaultRange = useMemo(() => getWelcomeDefaultDateRange(), []);
  const [draftFrom, setDraftFrom] = useState(defaultRange.dateFrom);
  const [draftTo, setDraftTo] = useState(defaultRange.dateTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultRange.dateFrom);
  const [appliedTo, setAppliedTo] = useState(defaultRange.dateTo);
  const [metric, setMetric] = useState('punctuality');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
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

  const metricLabel = WELCOME_METRIC_OPTIONS.find((option) => option.id === metric)?.label || 'Metric';
  const draftDirty = draftFrom !== appliedFrom || draftTo !== appliedTo;

  function applyRange() {
    const from = draftFrom || toDateInputValue(new Date());
    const to = draftTo || from;
    const orderedFrom = from <= to ? from : to;
    const orderedTo = from <= to ? to : from;
    setDraftFrom(orderedFrom);
    setDraftTo(orderedTo);
    setAppliedFrom(orderedFrom);
    setAppliedTo(orderedTo);
  }

  function clearRange() {
    const next = getWelcomeDefaultDateRange();
    setDraftFrom(next.dateFrom);
    setDraftTo(next.dateTo);
    setAppliedFrom(next.dateFrom);
    setAppliedTo(next.dateTo);
  }

  return (
    <div className="tylo-home-welcome-metrics">
      <div className="tylo-home-welcome-controls">
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

        <div className="tylo-home-welcome-range" role="group" aria-label="Date range">
          <div className="tylo-home-welcome-range-inline">
            <DateInput
              hideLabel
              aria-label="From date"
              value={draftFrom}
              max={draftTo || undefined}
              onChange={setDraftFrom}
              className="tylo-home-welcome-range-date"
            />
            <span className="tylo-home-welcome-range-to">to</span>
            <DateInput
              hideLabel
              aria-label="To date"
              value={draftTo}
              min={draftFrom || undefined}
              onChange={setDraftTo}
              className="tylo-home-welcome-range-date"
            />
            <button
              type="button"
              className="tylo-home-welcome-range-apply"
              onClick={applyRange}
              disabled={!draftFrom || !draftTo}
              aria-label="Apply date range"
              title="Apply"
            >
              Apply
            </button>
            <button
              type="button"
              className="tylo-home-welcome-range-clear"
              onClick={clearRange}
              aria-label="Reset date range"
              title="Reset to current month"
            >
              <ClearGlyph />
            </button>
          </div>
          {draftDirty ? (
            <p className="tylo-home-welcome-range-hint">Press Apply to update metrics.</p>
          ) : null}
        </div>
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
