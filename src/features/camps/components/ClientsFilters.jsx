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
      <div className="inv-toolbar logistics-toolbar camp-ops-toolbar">
        <input
          id="clients-search"
          className="esign-search inv-search"
          placeholder="Client name or code…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
        />
        <button type="button" className="btn secondary" onClick={onSearchSubmit}>
          Search
        </button>
        {canCreate && (
          <button type="button" className="btn" onClick={onCreate}>
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
          <button type="button" className="btn secondary btn-compact" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      )}
    </>
  );
}
