import FieldError from './FieldError.jsx';
import { bindAutofillBlock } from '../../shared/suppressBrowserAutofill.js';

/**
 * Standard 10-digit Indian mobile input with digit-only normalization.
 */
export function PhoneField({
  id,
  name,
  label,
  value = '',
  onChange,
  error = '',
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  hideLabel = false,
  placeholder = '10-digit mobile number',
  'aria-label': ariaLabel,
}) {
  const inputId = id || name || `phone-field-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const invalid = Boolean(error);

  function handleChange(event) {
    const digits = event.target.value.replace(/[^\d]/g, '').slice(0, 10);
    onChange?.(digits);
  }

  const input = (
    <input
      id={inputId}
      name={name}
      type="text"
      inputMode="numeric"
      maxLength={10}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-label={hideLabel ? ariaLabel || label : undefined}
      className={[invalid ? 'input-invalid' : '', inputClassName].filter(Boolean).join(' ')}
      {...bindAutofillBlock()}
    />
  );

  if (hideLabel) {
    return (
      <>
        {input}
        <FieldError message={error} />
      </>
    );
  }

  return (
    <label className={className} htmlFor={inputId}>
      {label}
      {required ? ' *' : ''}
      {input}
      <FieldError message={error} />
    </label>
  );
}
