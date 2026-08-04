import { DateInput } from './DateInput';
import { FILTER } from '../../../shared/labels.js';
import { getQuickDateRange, matchQuickPreset } from '../utils/dateRange';
import MasterSearchField from '../../../components/masters/MasterSearchField.jsx';

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

const REQUEST_STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'information_requested', label: 'Information requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Refused' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'cancelled_by_tcpl', label: 'Cancelled by TCPL' },
  { value: 'cancelled_by_client', label: 'Cancelled by client' },
];

const EXECUTION_STATUS_OPTIONS = [
  { value: 'yet_to_start', label: 'Yet to start' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'executed', label: 'Marked executed' },
  { value: 'completed', label: 'Camp completed' },
  { value: 'cancelled_by_tcpl', label: 'Cancelled by TCPL' },
  { value: 'cancelled_by_client', label: 'Cancelled by client' },
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
  const showAlerts = workingStage === 'request' || workingStage === 'execution';

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
              aria-label="Status and alerts"
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
            >
              <option value="">{FILTER.ALL_STATUSES}</option>
              {showAlerts && alertOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
