/**
 * Standard date-range filter: calendar From/To + mandatory Submit and Clear.
 */
export default function DateRangeFilter({
  from = '',
  to = '',
  onFromChange,
  onToChange,
  onSubmit,
  onClear,
  submitting = false,
  submitLabel = 'Submit',
  clearLabel = 'Clear',
  disabled = false,
  className = '',
  children,
  hint,
}) {
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    onSubmit?.(e);
  };

  const handleClear = (e) => {
    e?.preventDefault?.();
    onClear?.(e);
  };

  return (
    <form
      className={`date-range-filter${className ? ` ${className}` : ''}`}
      aria-label="Date range filter"
      onSubmit={handleSubmit}
    >
      <div className="date-range-filter-fields">
        <label className="date-range-filter-field">
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            disabled={disabled || submitting}
            onChange={(e) => onFromChange?.(e.target.value)}
          />
        </label>
        <label className="date-range-filter-field">
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            disabled={disabled || submitting}
            onChange={(e) => onToChange?.(e.target.value)}
          />
        </label>
        {children}
        <div className="date-range-filter-actions">
          <button className="btn" type="submit" disabled={disabled || submitting}>
            {submitting ? 'Loading…' : submitLabel}
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={disabled || submitting}
            onClick={handleClear}
          >
            {clearLabel}
          </button>
        </div>
      </div>
      {hint ? <p className="muted date-range-filter-hint">{hint}</p> : null}
    </form>
  );
}
