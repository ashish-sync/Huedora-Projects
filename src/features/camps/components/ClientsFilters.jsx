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
    <div className="camps-filter-panel panel">
      <div className="camps-filter-top">
        <div className="field field-grow">
          <label htmlFor="clients-search">Search clients</label>
          <div className="camps-search-row">
            <input
              id="clients-search"
              placeholder="Client name or code..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            />
            <button type="button" className="btn btn-primary" onClick={onSearchSubmit}>
              Search
            </button>
          </div>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary camps-import-btn" onClick={onCreate}>
            New Client
          </button>
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
