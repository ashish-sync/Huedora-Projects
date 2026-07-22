import { useEffect, useId, useRef, useState } from 'react';
import { formatDate, toApiDateValue } from '../../shared/dateFormat.js';

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1zm12.5 8H4.5v9.5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V10zM6 6H4.5a.5.5 0 0 0-.5.5V8h17V6.5a.5.5 0 0 0-.5-.5H18v1a1 1 0 1 1-2 0V6H8v1a1 1 0 1 1-2 0V6z"
      />
    </svg>
  );
}

/**
 * Standard date field: DD-MM-YYYY display, YYYY-MM-DD value, integrated calendar picker.
 */
export function DateInput({
  id: idProp,
  name,
  label,
  value = '',
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  hideLabel = false,
  placeholder = 'dd - mm - yyyy',
  'aria-label': ariaLabel,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const pickerRef = useRef(null);
  const apiValue = toApiDateValue(value) || '';

  const [displayValue, setDisplayValue] = useState(() => (apiValue ? formatDate(apiValue) : ''));

  useEffect(() => {
    setDisplayValue(apiValue ? formatDate(apiValue) : '');
  }, [apiValue]);

  function commitDisplay(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      setDisplayValue('');
      onChange?.('');
      return;
    }

    const parsed = toApiDateValue(trimmed);
    if (!parsed) {
      setDisplayValue(apiValue ? formatDate(apiValue) : '');
      return;
    }

    if (min && parsed < min) {
      setDisplayValue(apiValue ? formatDate(apiValue) : '');
      return;
    }
    if (max && parsed > max) {
      setDisplayValue(apiValue ? formatDate(apiValue) : '');
      return;
    }

    setDisplayValue(formatDate(parsed));
    if (parsed !== apiValue) {
      onChange?.(parsed);
    }
  }

  function handlePickerChange(event) {
    const next = event.target.value;
    setDisplayValue(next ? formatDate(next) : '');
    onChange?.(next);
  }

  function openPicker() {
    if (disabled) return;
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }
    picker.focus();
    picker.click();
  }

  const control = (
    <div className={`date-input-control${disabled ? ' is-disabled' : ''}`}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        className={`date-input-display${inputClassName ? ` ${inputClassName}` : ''}`}
        placeholder={placeholder}
        value={displayValue}
        required={required}
        disabled={disabled}
        aria-label={hideLabel ? (ariaLabel || label) : undefined}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={(e) => commitDisplay(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDisplay(e.currentTarget.value);
        }}
      />
      <button
        type="button"
        className="date-input-picker-btn"
        onClick={openPicker}
        disabled={disabled}
        aria-label={label ? `Open calendar for ${label}` : 'Open calendar'}
        tabIndex={-1}
      >
        <CalendarIcon />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="date-input-native"
        value={apiValue}
        min={min || undefined}
        max={max || undefined}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePickerChange}
      />
    </div>
  );

  if (hideLabel) {
    return <div className={`date-input-field${className ? ` ${className}` : ''}`}>{control}</div>;
  }

  return (
    <div className={`field date-input-field${className ? ` ${className}` : ''}`}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {control}
    </div>
  );
}

export default DateInput;
