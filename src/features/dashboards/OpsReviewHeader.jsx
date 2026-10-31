import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import DateRangeFilter from '../../components/ui/DateRangeFilter.jsx';
import './opsReviewHeader.css';

const OpsReviewSlotContext = createContext(null);

function sameSlot(prev, next) {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return (
    prev.totalLabel === next.totalLabel
    && prev.totalValue === next.totalValue
    && prev.totalHref === next.totalHref
  );
}

export function OpsReviewSlotProvider({ children }) {
  const [slot, setSlotState] = useState(null);
  const [filtersHost, setFiltersHostState] = useState(null);

  const setSlot = useCallback((next) => {
    setSlotState((prev) => {
      if (next == null) return prev == null ? prev : null;
      return sameSlot(prev, next) ? prev : next;
    });
  }, []);

  const setFiltersHost = useCallback((node) => {
    setFiltersHostState((prev) => (prev === node ? prev : node));
  }, []);

  const value = useMemo(
    () => ({ slot, setSlot, filtersHost, setFiltersHost }),
    [slot, filtersHost, setSlot, setFiltersHost],
  );

  return <OpsReviewSlotContext.Provider value={value}>{children}</OpsReviewSlotContext.Provider>;
}

export function useOpsReviewSlotState() {
  return useContext(OpsReviewSlotContext);
}

/** Register Total + module filters into the shared Operations Dashboard header. */
export function OpsReviewSlot({
  totalLabel = 'Total',
  totalValue = 0,
  totalHref = '',
  children = null,
}) {
  const ctx = useContext(OpsReviewSlotContext);
  const setSlot = ctx?.setSlot;
  const filtersHost = ctx?.filtersHost;

  useLayoutEffect(() => {
    if (!setSlot) return undefined;
    setSlot({ totalLabel, totalValue, totalHref });
    return () => setSlot(null);
  }, [setSlot, totalLabel, totalValue, totalHref]);

  if (filtersHost && children) {
    return createPortal(children, filtersHost);
  }
  if (ctx) return null;
  return children;
}

export default function OpsReviewHeader({
  presets = [],
  preset = '',
  onPreset,
  from = '',
  to = '',
  onFrom,
  onTo,
  moduleId = '',
  modules = [],
  onModule,
  onSubmit,
  onClear,
  submitting = false,
  disabled = false,
  fallbackTotal = null,
}) {
  const ctx = useOpsReviewSlotState();
  const setFiltersHost = ctx?.setFiltersHost;
  const total = ctx?.slot || fallbackTotal;
  const totalLabel = total?.totalLabel || total?.label;
  const totalValue = total?.totalValue ?? total?.value ?? 0;
  const totalHref = total?.totalHref || total?.href || '';
  const showMeta = Boolean(totalLabel);

  const filtersRef = useCallback((node) => {
    setFiltersHost?.(node);
  }, [setFiltersHost]);

  return (
    <div className="ops-review-header" aria-label="Module review filters">
      {presets.length ? (
        <div className="ops-review-header__presets" role="group" aria-label="Quick ranges">
          {presets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`track-range-chip${preset === item.id ? ' is-active' : ''}`}
              onClick={() => onPreset?.(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <DateRangeFilter
        className="ops-review-header__range date-range-filter--panel"
        from={from}
        to={to}
        fromLabel="From date"
        toLabel="To date"
        onFromChange={onFrom}
        onToChange={onTo}
        onSubmit={onSubmit}
        onClear={onClear}
        submitting={submitting}
        disabled={disabled}
      >
        <label className="date-range-filter-field module-review-module">
          <span>Module</span>
          <AdaptiveSelect
            required
            value={moduleId}
            onChange={(e) => onModule?.(e.target.value)}
            aria-label="Module"
          >
            <option value="">Select module</option>
            {modules.map((mod) => (
              <option key={mod.id} value={mod.id}>
                {mod.label}
              </option>
            ))}
          </AdaptiveSelect>
        </label>
      </DateRangeFilter>

      <div className="ops-review-header__meta" hidden={!showMeta}>
        {showMeta && totalHref ? (
          <Link className="ops-review-header__total" to={totalHref}>
            <span className="ops-review-header__total-label">{totalLabel}</span>
            <strong className="ops-review-header__total-value">
              {Number(totalValue).toLocaleString('en-IN')}
            </strong>
          </Link>
        ) : null}
        {showMeta && !totalHref ? (
          <div className="ops-review-header__total">
            <span className="ops-review-header__total-label">{totalLabel}</span>
            <strong className="ops-review-header__total-value">
              {Number(totalValue).toLocaleString('en-IN')}
            </strong>
          </div>
        ) : null}
        <div className="ops-review-header__filters" ref={filtersRef} />
      </div>
    </div>
  );
}
