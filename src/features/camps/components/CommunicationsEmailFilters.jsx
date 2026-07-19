import { formatDateRangeLabel } from '../utils/dateFormat';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.5 3a7.5 7.5 0 0 1 5.92 12.09l4.39 4.39-1.41 1.41-4.39-4.39A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"
        fill="currentColor"
      />
    </svg>
  );
}

const CANDIDATE_OPTIONS = [
  { value: 'all', label: 'All emails' },
  { value: 'candidates', label: 'Campaign candidates' },
  { value: 'other', label: 'Other emails' },
];

const CAMPS_OPTIONS = [
  { value: 'all', label: 'All camp states' },
  { value: 'created', label: 'Camps created' },
  { value: 'none', label: 'No camps yet' },
];

export function CommunicationsEmailFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  candidateFilter,
  onCandidateFilterChange,
  campsFilter,
  onCampsFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  status,
  syncing,
  onSync,
  activeChips,
  onClearAll,
}) {
  return (
    <div className="communications-filter-panel panel">
      <div className="communications-filter-top">
        <label htmlFor="communications-email-search" className="communications-filter-search-block">
          <span className="communications-filter-label">Search emails</span>
          <div className="communications-search-row">
            <div className="communications-search-field">
              <span className="communications-search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <input
                id="communications-email-search"
                className="communications-search-input"
                placeholder="Search sender, subject, or message body..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
              />
            </div>
            <button type="button" className="btn btn-primary communications-search-btn" onClick={onSearchSubmit}>
              Search
            </button>
            <button
              type="button"
              className="btn btn-primary communications-sync-btn"
              onClick={onSync}
              disabled={syncing || !status?.imapConfigured}
            >
              {syncing ? 'Syncing...' : 'Sync Gmail'}
            </button>
          </div>
        </label>
      </div>

      <div className="communications-filter-dates">
        <label>
          <span className="communications-filter-label">Fetch from date</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>
        <label>
          <span className="communications-filter-label">Fetch to date</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </label>
        <p className="meta-text communications-filter-date-hint">
          Date range applies to Gmail sync and inbox list filtering.
          {(dateFrom || dateTo) && ` Active: ${formatDateRangeLabel(dateFrom, dateTo)}`}
        </p>
      </div>

      <div className="communications-filter-toolbar">
        <div className="communications-candidate-filters" role="group" aria-label="Filter by campaign match">
          {CANDIDATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`communications-candidate-btn${candidateFilter === option.value ? ' is-active' : ''}`}
              aria-pressed={candidateFilter === option.value}
              onClick={() => onCandidateFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="communications-candidate-filters" role="group" aria-label="Filter by camp creation">
          {CAMPS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`communications-candidate-btn${campsFilter === option.value ? ' is-active' : ''}`}
              aria-pressed={campsFilter === option.value}
              onClick={() => onCampsFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {status && (
          <div className="communications-mailbox-meta">
            <span className="communications-mailbox-label">Mailbox</span>
            <strong>{status.mailboxUser || 'Not configured'}</strong>
            {!status.imapConfigured && (
              <span className="communications-mailbox-hint">Configure EMAIL_IMAP_* in server .env</span>
            )}
          </div>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="communications-filter-chips">
          {activeChips.map((chip) => (
            <span key={chip.key} className="filter-chip">
              {chip.label}
              <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={chip.onRemove}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
