import { useId } from 'react';
import { normalizeTimeOfDay } from '../../shared/dateFormat.js';
import { bindAutofillBlock } from '../../shared/suppressBrowserAutofill.js';

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm.75 3a.75.75 0 0 1 .75.75V12h3.25a.75.75 0 1 1 0 1.5h-4a.75.75 0 0 1-.75-.75V7.75A.75.75 0 0 1 12.75 7z"
      />
    </svg>
  );
}

export function formatTimeDisplay(value) {
  const api = normalizeTimeOfDay(value);
  if (!api) return '';
  const [hours, minutes] = api.split(':').map(Number);
  const date = new Date(1970, 0, 1, hours, minutes);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Time field that keeps the native picker (needed on iPhone) while the visible
 * control stays inside its grid cell. A full-size transparent type=time overlay
 * receives the tap; the styled display never uses iOS's wide intrinsic chrome.
 */
export function TimeInput({
  id: idProp,
  name,
  label,
  value = '',
  onChange,
  required = false,
  disabled = false,
  className = '',
  hideLabel = false,
  'aria-label': ariaLabel,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const apiValue = normalizeTimeOfDay(value);

  const display = formatTimeDisplay(apiValue);

  const control = (
    <div className={`date-input-control time-input-control${disabled ? ' is-disabled' : ''}`}>
      <span className={`date-input-display${display ? '' : ' is-placeholder'}`} aria-hidden="true">
        {display || 'hh : mm'}
      </span>
      <span className="date-input-picker-btn" aria-hidden="true">
        <ClockIcon />
      </span>
      <input
        id={id}
        type="time"
        className="date-input-native time-input-native"
        name={name}
        value={apiValue}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel || label || 'Time'}
        onChange={(event) => onChange?.(normalizeTimeOfDay(event.target.value))}
        {...bindAutofillBlock()}
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

export default TimeInput;
