export default function MasterSearchField({
  value,
  onChange,
  placeholder = 'Search…',
  'aria-label': ariaLabel,
  onKeyDown,
  className = '',
  id,
}) {
  return (
    <div className={`master-search-field${className ? ` ${className}` : ''}`}>
      <span className="master-search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path
            d="M10.5 3a7.5 7.5 0 0 1 5.92 12.09l4.39 4.39-1.41 1.41-4.39-4.39A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"
            fill="currentColor"
          />
        </svg>
      </span>
      <input
        id={id}
        type="search"
        className="master-search-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
    </div>
  );
}
