import { DateInput } from './DateInput';
import { FILTER } from '../../../shared/labels.js';
import { getQuickDateRange, matchQuickPreset } from '../utils/dateRange';
import { REQUEST_REVIEW_FILTER_OPTIONS } from '../constants/requestReviewStatus';
import {
  ASSIGNMENT_STAGE_FILTER_OPTIONS,
  EXECUTION_STAGE_FILTER_OPTIONS,
  FINANCIAL_STAGE_FILTER_OPTIONS,
} from '../constants/campStageFilters';

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
  { value: 'rejected', label: 'Refused' },
  { value: 'cancelled', label: 'Cancelled' },
];

function stageFilterOptions({
  assignmentStage,
  requestStage,
  executionStage,
  financialStage,
}) {
  if (assignmentStage) return ASSIGNMENT_STAGE_FILTER_OPTIONS;
  if (requestStage) return REQUEST_REVIEW_FILTER_OPTIONS;
  if (executionStage) return EXECUTION_STAGE_FILTER_OPTIONS;
  if (financialStage) return FINANCIAL_STAGE_FILTER_OPTIONS;
  return null;
}

function stageFilterAriaLabel({
  assignmentStage,
  requestStage,
  executionStage,
  financialStage,
}) {
  if (assignmentStage) return 'Assignment status';
  if (requestStage) return 'Request review status';
  if (executionStage) return 'Execution status';
  if (financialStage) return 'Finance payment status';
  return 'Status and alerts';
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
  assignmentStage = false,
  requestStage = false,
  executionStage = false,
  financialStage = false,
}) {
  const activePreset = matchQuickPreset(dateFrom, dateTo);
  const stageOptions = stageFilterOptions({
    assignmentStage,
    requestStage,
    executionStage,
    financialStage,
  });
  const filterAriaLabel = stageFilterAriaLabel({
    assignmentStage,
    requestStage,
    executionStage,
    financialStage,
  });

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
          <input
            id="camps-search"
            className="camps-filter-control camps-filter-search"
            placeholder="Search camp ID, doctor, city…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          />
          <button type="button" className="btn secondary btn-compact" onClick={onSearchSubmit}>
            Search
          </button>
        </div>

        <span className="camps-filter-divider" aria-hidden="true" />

        <select
          id="camps-status-filter"
          className="camps-filter-control camps-filter-status tylo-select"
          aria-label={filterAriaLabel}
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          {stageOptions ? (
            stageOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))
          ) : (
            <>
              <option value="">{FILTER.ALL_CAMPS}</option>
              {alertOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </>
          )}
        </select>

        <span className="camps-filter-divider" aria-hidden="true" />

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
            <span className="camps-filter-date-sep">to</span>
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
