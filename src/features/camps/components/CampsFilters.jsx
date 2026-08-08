import { DateInput } from './DateInput';
import { FILTER } from '../../../shared/labels.js';
import { getQuickDateRange, matchQuickPreset } from '../utils/dateRange';
import MasterSearchField from '../../../components/masters/MasterSearchField.jsx';

const quickPresets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'tomorrow', label: 'Tomorrow' },
];

/** Request Stage status filter — review workflow only. */
export const REQUEST_STATUS_OPTIONS = [
  { value: 'request_rejected', label: 'Refused' },
  {
    value: 'review_pending',
    label: 'Review Pending',
    title: 'Default for requests created within the last 6 working hours',
  },
  {
    value: 'review_overdue',
    label: 'Review Overdue',
    title: 'Still in Review Pending for more than 6 working hours',
  },
  {
    value: 'information_requested',
    label: 'Info Requested',
    title: 'Required camp details are incomplete',
  },
];

const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'hiring_requested', label: 'Hiring Requested' },
  { value: 'cancelled_by_tylo', label: 'Cancelled by Tylo' },
  { value: 'cancelled_by_client', label: 'Cancelled by Client' },
];

export { ASSIGNMENT_STATUS_OPTIONS };

const EXECUTION_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'executed', label: 'Marked executed' },
  { value: 'cancelled_by_tylo', label: 'Cancelled by Tylo' },
  { value: 'cancelled_by_client', label: 'Cancelled by Client' },
];

const FINANCIAL_STATUS_OPTIONS = [
  { value: 'payment_not_checked', label: 'Validation Pending' },
  { value: 'payment_confirmed', label: 'Validation Completed' },
  { value: 'payment_hold', label: 'Payment On Hold' },
  { value: 'payment_completed', label: 'Payment Completed' },
];

function statusOptionsForStage(stage) {
  if (stage === 'assignment') return ASSIGNMENT_STATUS_OPTIONS;
  if (stage === 'execution') return EXECUTION_STATUS_OPTIONS;
  if (stage === 'financial') return FINANCIAL_STATUS_OPTIONS;
  return REQUEST_STATUS_OPTIONS;
}

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
  showStatusFilter = true,
  workingStage = 'request',
}) {
  const activePreset = matchQuickPreset(dateFrom, dateTo);
  const statusOptions = statusOptionsForStage(workingStage);

  function handleQuickSelect(preset) {
    const range = getQuickDateRange(preset);
    onDateFromChange(range.dateFrom);
    onDateToChange(range.dateTo);
    onQuickSelect(range);
  }

  return (
    <div className="camps-filter-card">
      <div className="camps-filter-toolbar">
        <div className="camps-filter-group camps-filter-group--search">
          <MasterSearchField
            id="camps-search"
            className="camps-filter-search"
            placeholder="Search camp ID, doctor, city…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            aria-label="Search camps"
          />
          <button type="button" className="btn secondary btn-compact" onClick={onSearchSubmit}>
            Search
          </button>
        </div>

        <div className="camps-filter-toolbar__filters">
          {showStatusFilter && (
            <select
              id="camps-status-filter"
              className="camps-filter-control camps-filter-status tylo-select"
              aria-label="Status"
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
            >
              <option value="">{FILTER.ALL_STATUSES}</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value} title={option.title || undefined}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          <div className="camps-filter-group camps-filter-group--dates" role="group" aria-label="Date filters">
            <div className="camps-filter-quick-dates" role="group" aria-label="Quick date filters">
              {quickPresets.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`btn secondary btn-compact camps-filter-preset${activePreset === key ? ' is-active' : ''}`}
                  onClick={() => handleQuickSelect(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="camps-filter-date-range">
              <DateInput
                id="camps-date-from"
                hideLabel
                className="camps-filter-date-field"
                value={dateFrom}
                onChange={onDateFromChange}
              />
              <span className="camps-filter-date-sep" aria-hidden="true">to</span>
              <DateInput
                id="camps-date-to"
                hideLabel
                className="camps-filter-date-field"
                value={dateTo}
                onChange={onDateToChange}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button type="button" className="btn secondary btn-compact" onClick={onClearDates}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="camps-filter-chips camps-filter-chips--row">
          {activeChips.map((chip) => (
            <span key={chip.key} className="filter-chip">
              {chip.label}
              {chip.onRemove && (
                <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={chip.onRemove}>
                  ×
                </button>
              )}
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
