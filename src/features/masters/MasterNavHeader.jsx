import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export const MASTER_ENTITY_META = {
  products: {
    description: 'Inventory catalog, medical devices, SKU mapping and stock thresholds',
    badge: 'Inventory',
    keywords: ['items', 'devices', 'equipment', 'stock', 'uom', 'sku', 'brands'],
  },
  vendors: {
    description: 'Vendor profiles, billing addresses, GSTIN, bank details and PDF agreements',
    badge: 'Logistics',
    keywords: ['suppliers', 'finance', 'payout', 'gst', 'bank', 'pan', 'ifsc'],
  },
  'expense-categories': {
    description: 'Operational expense categories and subcategory cost allocations',
    badge: 'Finance',
    keywords: ['budget', 'costs', 'accounts', 'claims', 'finance', 'subcategories'],
  },
  contacts: {
    description: 'Unified directory of resources, clients, vendors and healthcare workers',
    badge: 'Directory',
    keywords: ['people', 'staff', 'phlebotomists', 'doctors', 'clients', 'partners'],
  },
  templates: {
    description: 'Word and PDF agreement templates, placeholders and signing types',
    badge: 'Documents',
    keywords: ['docx', 'contracts', 'letters', 'leases', 'legal'],
  },
  signatures: {
    description: 'Authorized signatories, executive delegations and typed signatures',
    badge: 'E-Sign',
    keywords: ['approvers', 'delegates', 'hr', 'cfo', 'ceo', 'legal'],
  },
  'picklist-approvals': {
    description: 'Review and approve user-suggested custom dropdown picklist entries',
    badge: 'Governance',
    keywords: ['values', 'custom fields', 'options', 'requests'],
  },
  'client-masters': {
    description: 'Client operational agreements, program settings and camp presets',
    badge: 'Operations',
    keywords: ['customers', 'camps', 'programs', 'po', 'rates', 'presets'],
  },
  'pin-codes': {
    description: 'Postal code mapping, states, zones and district logistics data',
    badge: 'Geography',
    keywords: ['locations', 'pincode', 'postal', 'regions', 'districts', 'states'],
  },
};

function matchesSearchTerm(text, query) {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (query.length <= 3) {
    const words = lower.split(/[^a-z0-9]+/);
    return words.some((w) => w.startsWith(query));
  }
  return lower.includes(query);
}

export default function MasterNavHeader({
  groups = [],
  activeGroup = null,
  activeEntity = null,
  onSelectEntity,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Filter groups and entities based on search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((group) => {
        const groupLabelMatch = matchesSearchTerm(group.label, q);
        const matchingEntities = group.entities.filter((entity) => {
          if (groupLabelMatch) return true;
          if (matchesSearchTerm(entity.label, q)) return true;
          if (matchesSearchTerm(entity.id, q)) return true;

          const meta = MASTER_ENTITY_META[entity.id];
          if (matchesSearchTerm(meta?.description, q)) return true;
          if (meta?.keywords?.some((kw) => matchesSearchTerm(kw, q))) return true;
          return false;
        });

        if (matchingEntities.length > 0) {
          return { ...group, entities: matchingEntities };
        }
        return null;
      })
      .filter(Boolean);
  }, [groups, searchQuery]);

  // Flattened list for keyboard arrow navigation
  const flatFilteredList = useMemo(() => {
    return filteredGroups.flatMap((g) => g.entities);
  }, [filteredGroups]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  }, []);

  const openPopover = useCallback(() => {
    setIsOpen(true);
    setSearchQuery('');
    // Highlight the currently active entity if in the list, else first item
    const activeIdx = flatFilteredList.findIndex((item) => item.id === activeEntity?.id);
    setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);
  }, [flatFilteredList, activeEntity]);

  const togglePopover = useCallback(() => {
    if (isOpen) {
      closePopover();
      triggerRef.current?.focus();
    } else {
      openPopover();
    }
  }, [isOpen, closePopover, openPopover]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closePopover();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, closePopover]);

  // Global Alt+M keyboard shortcut to toggle master navigation popover
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (isOpen) {
          closePopover();
          triggerRef.current?.focus();
        } else {
          openPopover();
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, closePopover, openPopover]);

  const handleSelectItem = useCallback((entityId) => {
    onSelectEntity(entityId);
    closePopover();
    triggerRef.current?.focus();
  }, [onSelectEntity, closePopover]);

  // Keyboard navigation within the popover
  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!flatFilteredList.length) return;
      setHighlightedIndex((prev) => (prev + 1) % flatFilteredList.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flatFilteredList.length) return;
      setHighlightedIndex((prev) => (prev - 1 + flatFilteredList.length) % flatFilteredList.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (flatFilteredList[highlightedIndex]) {
        handleSelectItem(flatFilteredList[highlightedIndex].id);
      }
    }
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPopover();
    }
  };

  const handlePillClick = (group) => {
    if (activeGroup?.id === group.id && activeEntity) {
      // Already in this group; no-op or keep active
      return;
    }
    // Switch to first entity in this group
    if (group.entities?.length > 0) {
      onSelectEntity(group.entities[0].id);
    }
  };

  return (
    <header className="master-nav-header" role="navigation" aria-label="Master One navigation">
      <div className="master-nav-bar">
        <div className="master-nav-bar__context" ref={containerRef}>
          <button
            type="button"
            ref={triggerRef}
            className={`master-nav-trigger${isOpen ? ' is-active' : ''}`}
            onClick={togglePopover}
            onKeyDown={handleTriggerKeyDown}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label={`Current master directory: ${activeEntity?.label || 'Select'}. Click to switch master directory.`}
            title="Switch master directory (Alt+M)"
          >
            <span className="master-nav-trigger__prefix">{activeGroup?.label || 'Master'}</span>
            <span className="master-nav-trigger__sep" aria-hidden="true">/</span>
            <span className="master-nav-trigger__name">{activeEntity?.label || 'Select Master'}</span>
            <kbd className="master-nav-trigger__kbd" title="Shortcut: Alt+M">Alt+M</kbd>
            <svg
              className={`master-nav-trigger__chevron${isOpen ? ' is-open' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isOpen && (
            <div
              className="master-nav-popover"
              ref={popoverRef}
              role="dialog"
              aria-modal="true"
              aria-label="Switch master directory"
            >
              <div className="master-nav-popover__search">
                <svg
                  className="master-nav-popover__search-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M12.5 12.5L17 17" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="search"
                  className="master-nav-popover__input"
                  placeholder="Search master directories (e.g. Vendors, Contacts, Products)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleInputKeyDown}
                  autoComplete="off"
                  spellCheck="false"
                  aria-label="Filter master directories"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="master-nav-popover__clear"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="master-nav-popover__body" ref={listRef} role="listbox">
                {filteredGroups.length === 0 ? (
                  <div className="master-nav-popover__empty">
                    No directories matching &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.id} className="master-nav-popover__group">
                      <div className="master-nav-popover__group-label">{group.label}</div>
                      <div className="master-nav-popover__group-items">
                        {group.entities.map((item) => {
                          const isSelected = activeEntity?.id === item.id;
                          const isHighlighted = flatFilteredList[highlightedIndex]?.id === item.id;
                          const meta = MASTER_ENTITY_META[item.id];
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={`master-nav-popover__item${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-highlighted' : ''}`}
                              onClick={() => handleSelectItem(item.id)}
                              onMouseEnter={() => {
                                const idx = flatFilteredList.findIndex((x) => x.id === item.id);
                                if (idx >= 0) setHighlightedIndex(idx);
                              }}
                            >
                              <div className="master-nav-popover__item-main">
                                <div className="master-nav-popover__item-head">
                                  <span className="master-nav-popover__item-title">{item.label}</span>
                                  {meta?.badge && (
                                    <span className="master-nav-popover__item-badge">{meta.badge}</span>
                                  )}
                                </div>
                                {meta?.description && (
                                  <p className="master-nav-popover__item-desc">{meta.description}</p>
                                )}
                              </div>
                              {isSelected && (
                                <span className="master-nav-popover__check" aria-hidden="true" title="Currently active">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="master-nav-popover__footer">
                <span className="master-nav-popover__hint">
                  <kbd>↑</kbd><kbd>↓</kbd> Navigate · <kbd>↵</kbd> Select · <kbd>Esc</kbd> Close
                </span>
                <span className="master-nav-popover__count">
                  {flatFilteredList.length} {flatFilteredList.length === 1 ? 'directory' : 'directories'}
                </span>
              </div>
            </div>
          )}
        </div>

        <nav className="master-nav-pills" aria-label="Master sections">
          {groups.map((group) => {
            const isActive = activeGroup?.id === group.id;
            return (
              <button
                key={group.id}
                type="button"
                className={`master-nav-pill${isActive ? ' is-active' : ''}`}
                onClick={() => handlePillClick(group)}
                aria-current={isActive ? 'page' : undefined}
              >
                {group.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
