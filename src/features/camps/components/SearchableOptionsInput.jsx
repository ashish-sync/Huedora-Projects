import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchDropdownKeyboard } from '../hooks/useSearchDropdownKeyboard';

function filterOptions(options, query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return options;
  return options.filter((option) => option.toLowerCase().includes(normalized));
}

export function SearchableOptionsInput({
  id,
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = 'Search or select',
  error = '',
  groupLabel = 'Options',
  emptyMessage = 'No matching options. You can keep your typed value.',
  maxResults = 20,
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const suppressOpenRef = useRef(false);

  const filteredOptions = useMemo(
    () => filterOptions(options, value).slice(0, maxResults),
    [options, value, maxResults],
  );

  function closeDropdown() {
    suppressOpenRef.current = true;
    setOpen(false);
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  }

  function openDropdown() {
    if (!suppressOpenRef.current) setOpen(true);
  }

  function handleSelect(option) {
    closeDropdown();
    onChange(option);
  }

  const {
    setItemRef,
    getItemClassName,
    handleKeyDown,
  } = useSearchDropdownKeyboard({
    open,
    itemCount: filteredOptions.length,
    onSelectIndex: (index) => handleSelect(filteredOptions[index]),
    onClose: closeDropdown,
    onOpen: openDropdown,
    resetDeps: [value, filteredOptions.length],
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="client-search-field" ref={wrapperRef}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          openDropdown();
        }}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-listbox` : undefined}
        className={error ? 'input-invalid' : ''}
      />
      {error && <small className="field-error">{error}</small>}
      {open && filteredOptions.length > 0 && (
        <div className="client-search-dropdown" id={id ? `${id}-listbox` : undefined} role="listbox">
          <div className="client-search-group-label">{groupLabel}</div>
          {filteredOptions.map((option, index) => (
            <button
              key={option}
              ref={(node) => setItemRef(index, node)}
              type="button"
              role="option"
              aria-selected={false}
              className={getItemClassName(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option)}
            >
              <span>{option}</span>
            </button>
          ))}
        </div>
      )}
      {open && value && filteredOptions.length === 0 && (
        <div className="client-search-dropdown">
          <div className="client-search-empty">{emptyMessage}</div>
        </div>
      )}
    </div>
  );
}
