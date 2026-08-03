import { Link } from 'react-router-dom';

import { CLIENT_MASTER_NEW_PATH } from '../clientMasterPaths.js';
import MasterFilterShell from '../../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../../components/masters/MasterSearchField.jsx';

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
      <MasterFilterShell
        actions={
          <>
            <button type="button" className="btn secondary btn-compact" onClick={onSearchSubmit}>
              Search
            </button>
            {showCreateLink ? (
              <Link to={CLIENT_MASTER_NEW_PATH} className="btn btn-compact">
                New Program Config
              </Link>
            ) : null}
          </>
        }
      >
        <MasterSearchField
          id="client-master-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          placeholder="Client name, program, camp, SPOC…"
          aria-label="Search program configs"
        />
      </MasterFilterShell>

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
