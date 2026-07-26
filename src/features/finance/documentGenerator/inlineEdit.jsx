/** Inline field primitives — Zoho/Tally-style click-to-edit on the document */

export function InlineField({
  value,
  onChange,
  placeholder = 'Click to add…',
  className = '',
  type = 'text',
  mono = false,
}) {
  return (
    <input
      type={type}
      className={`ei-inline${mono ? ' ei-inline--mono' : ''} ${className}`.trim()}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export function InlineTextarea({ value, onChange, placeholder = 'Click to add…', className = '', rows = 2 }) {
  return (
    <textarea
      className={`ei-inline ei-inline--area ${className}`.trim()}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

export function InlineAddChip({ label, onClick }) {
  return (
    <button type="button" className="ei-add-chip" onClick={onClick}>
      <span className="ei-add-chip-icon" aria-hidden="true">+</span>
      {label}
    </button>
  );
}

export function InlineTableInput({ value, onChange, placeholder, className = '', align = 'left' }) {
  return (
    <input
      className={`ei-inline ei-inline--cell ei-inline--${align} ${className}`.trim()}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  );
}
