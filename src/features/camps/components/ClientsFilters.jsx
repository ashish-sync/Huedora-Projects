import MasterFilterShell from '../../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../../components/masters/MasterSearchField.jsx';

export function ClientsFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  canCreate,
  onCreate,
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
            {canCreate ? (
              <button type="button" className="btn btn-compact" onClick={onCreate}>
                New Client
              </button>
            ) : null}
          </>
        }
      >
        <MasterSearchField
          id="clients-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          placeholder="Client name or code…"
          aria-label="Search clients"
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
