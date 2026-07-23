import { DateInput } from './DateInput';
import { SelectDropdown } from './SelectDropdown';
import { getQuickDateRange, matchQuickPreset } from '../utils/dateRange';

const quickPresets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'tomorrow', label: 'Tomorrow' },
];

const alertOptions = [
  { value: 'reaction_required', label: 'Reaction required' },
  { value: 'off_hours', label: 'Off-hours submissions' },
  { value: 'weekend_attention', label: 'Weekend / late Saturday' },
  { value: 'overdue', label: 'Overdue — not executed' },
];

const statusOptions = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'executed', label: 'Executed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function CampsFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onQuickSelect,
  onClearDates,
  filterValue,
  onFilterChange,
  activeChips,
  onClearAll,
}) {
  const activePreset = matchQuickPreset(dateFrom, dateTo);

  function handleQuickSelect(preset) {
    const range = getQuickDateRange(preset);
    onDateFromChange(range.dateFrom);
    onDateToChange(range.dateTo);
    onQuickSelect(range);
  }

  return (
    <div className="camps-filter-panel panel">
      <div className="inv-toolbar logistics-toolbar camp-ops-toolbar">
        <input
          id="camps-search"
          className="esign-search inv-search"
          placeholder="Camp ID, doctor, clinic/hospital, city…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
        />
        <button type="button" className="btn secondary" onClick={onSearchSubmit}>
          Search
        </button>
      </div>

      <div className="camps-filter-grid">
        <section className="camps-filter-section">
          <span className="camps-filter-section-title">Date range</span>
          <div className="camps-filter-date-row">
            <div className="date-quick-filters" role="group" aria-label="Quick date filters">
              {quickPresets.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`btn secondary btn-compact date-quick-btn${activePreset === key ? ' is-active' : ''}`}
                  onClick={() => handleQuickSelect(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="camps-date-inputs">
              <DateInput
                id="camps-date-from"
                hideLabel
                value={dateFrom}
                onChange={onDateFromChange}
              />
              <span className="camps-date-separator">to</span>
              <DateInput
                id="camps-date-to"
                hideLabel
                value={dateTo}
                onChange={onDateToChange}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button type="button" className="btn secondary btn-compact" onClick={onClearDates}>
                Clear dates
              </button>
            )}
          </div>
        </section>

        <section className="camps-filter-section">
          <SelectDropdown
            id="camps-status-filter"
            label="Status & alerts"
            value={filterValue}
            options={[
              { value: '', label: 'All camps' },
              ...alertOptions.map((option) => ({ value: option.value, label: option.label })),
              ...statusOptions.map((option) => ({ value: option.value, label: option.label })),
            ]}
            onChange={onFilterChange}
          />
        </section>
      </div>

      {activeChips.length > 0 && (
        <div className="camps-filter-chips">
          {activeChips.map((chip) => (
            <span key={chip.key} className="filter-chip">
              {chip.label}
              <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={chip.onRemove}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className="btn secondary btn-compact" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
