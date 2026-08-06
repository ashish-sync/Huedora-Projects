/** Inline field primitives — Zoho/Tally-style click-to-edit on the document */

export function clampTextLines(text, maxLines) {
  if (!maxLines || maxLines < 1) return text ?? '';
  const parts = String(text ?? '').split('\n');
  if (parts.length <= maxLines) return String(text ?? '');
  return parts.slice(0, maxLines).join('\n');
}

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

/**
 * @param {object} props
 * @param {number} [props.maxLines] — hard cap on newline count (paste + typing)
 * @param {boolean} [props.shiftEnterNewline] — Enter alone does nothing; Shift+Enter inserts a line break
 */
export function InlineTextarea({
  value,
  onChange,
  placeholder = 'Click to add…',
  className = '',
  rows = 2,
  maxLines,
  shiftEnterNewline = false,
}) {
  return (
    <textarea
      className={`ei-inline ei-inline--area ${className}`.trim()}
      value={value ?? ''}
      onChange={(e) => onChange?.(clampTextLines(e.target.value, maxLines))}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        if (shiftEnterNewline) {
          if (!e.shiftKey) {
            e.preventDefault();
            return;
          }
          const lineCount = String(value ?? '').split('\n').length;
          if (maxLines && lineCount >= maxLines) e.preventDefault();
          return;
        }
        if (maxLines) {
          const lineCount = String(value ?? '').split('\n').length;
          if (lineCount >= maxLines) e.preventDefault();
        }
      }}
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
