import { Link } from 'react-router-dom';

import { CLIENT_MASTER_NEW_PATH } from '../clientMasterPaths.js';

export function ClientMasterProgramsFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  showCreateLink,
  activeChips,
  onClearAll,
}) {
  return (
    <>
      <div className="inv-toolbar logistics-toolbar camp-ops-toolbar">
        <input
          id="client-master-search"
          className="esign-search inv-search"
          placeholder="Client name, program, camp, SPOC…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
        />
        <button type="button" className="btn secondary" onClick={onSearchSubmit}>
          Search
        </button>
        {showCreateLink && (
          <Link to={CLIENT_MASTER_NEW_PATH} className="btn">
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
          <button type="button" className="btn secondary btn-compact" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      )}
    </>
  );
}
