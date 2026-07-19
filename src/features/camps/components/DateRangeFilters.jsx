import { DateInput } from './DateInput';
import { getQuickDateRange, matchQuickPreset } from '../utils/dateRange';

const quickPresets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'tomorrow', label: 'Tomorrow' },
];

export function DateRangeFilters({
  dateFrom,
  dateTo,
  appliedFrom,
  appliedTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  onQuickSelect,
  onClear,
  showApply = true,
  showClear = false,
  idPrefix = 'date',
}) {
  const activePreset = matchQuickPreset(
    appliedFrom ?? dateFrom,
    appliedTo ?? dateTo,
  );

  function handleQuickSelect(preset) {
    const range = getQuickDateRange(preset);
    onDateFromChange(range.dateFrom);
    onDateToChange(range.dateTo);
    onQuickSelect(range);
  }

  return (
    <div className="date-range-filters">
      <section className="date-range-section">
        <span className="date-range-section-label">Quick</span>
        <div className="date-quick-filters" role="group" aria-label="Quick date filters">
          {quickPresets.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`btn btn-secondary btn-sm date-quick-btn${activePreset === key ? ' is-active' : ''}`}
              onClick={() => handleQuickSelect(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="date-range-section date-range-section-dates">
        <span className="date-range-section-label">Date range</span>
        <div className="date-range-date-row">
          <DateInput
            id={`${idPrefix}-from`}
            hideLabel
            value={dateFrom}
            onChange={onDateFromChange}
          />
          <span className="date-range-separator">to</span>
          <DateInput
            id={`${idPrefix}-to`}
            hideLabel
            value={dateTo}
            onChange={onDateToChange}
          />
        </div>
      </section>

      <div className="date-range-actions">
        {showApply && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
            Apply
          </button>
        )}
        {showClear && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
