import { Link } from 'react-router-dom';

export function ClientMasterProgramsFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  showCreateLink,
  activeChips,
  onClearAll,
}) {
  return (
    <div className="camps-filter-panel panel">
      <div className="camps-filter-top">
        <div className="field field-grow">
          <label htmlFor="client-master-search">Search programs</label>
          <div className="camps-search-row">
            <input
              id="client-master-search"
              placeholder="Client name, program, camp, SPOC..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            />
            <button type="button" className="btn btn-primary" onClick={onSearchSubmit}>
              Search
            </button>
          </div>
        </div>
        {showCreateLink && (
          <Link to="/camps/client-masters/new" className="btn btn-primary camps-import-btn">
            New Program Config
          </Link>
        )}
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
