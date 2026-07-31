import FieldError from './FieldError.jsx';
import { PASSWORD_MANAGER_IGNORE } from '../../shared/suppressBrowserAutofill.js';

/**
 * Single email or comma-separated email list (textarea) with shared validation styling.
 */
export function EmailField({
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
  variant = 'single',
  rows = 2,
  placeholder,
  hint,
  autoComplete = 'off',
  'aria-label': ariaLabel,
}) {
  const inputId = id || name;
  const invalid = Boolean(error);
  const isList = variant === 'list';
  const resolvedPlaceholder = placeholder || (isList ? 'user@client.com, ops@client.com' : 'name@company.com');

  const sharedProps = {
    id: inputId,
    name,
    value,
    onChange: (event) => onChange?.(event.target.value),
    required,
    disabled,
    placeholder: resolvedPlaceholder,
    'aria-invalid': invalid || undefined,
    'aria-label': hideLabel ? ariaLabel || label : undefined,
    className: [invalid ? 'input-invalid' : '', inputClassName].filter(Boolean).join(' '),
  };

  const control = isList ? (
    <textarea
      rows={rows}
      autoComplete={PASSWORD_MANAGER_IGNORE.autoComplete}
      readOnly
      onFocus={(event) => {
        event.currentTarget.removeAttribute('readonly');
      }}
      {...sharedProps}
      {...PASSWORD_MANAGER_IGNORE}
    />
  ) : (
    <input
      type="text"
      inputMode="email"
      autoCapitalize="none"
      autoComplete={autoComplete === 'off' ? PASSWORD_MANAGER_IGNORE.autoComplete : autoComplete}
      readOnly={autoComplete === 'off'}
      onFocus={(event) => {
        if (autoComplete === 'off') event.currentTarget.removeAttribute('readonly');
      }}
      {...sharedProps}
      {...(autoComplete === 'off' ? PASSWORD_MANAGER_IGNORE : {})}
    />
  );

  if (hideLabel) {
    return (
      <>
        {control}
        {hint ? <small className="meta-text">{hint}</small> : null}
        <FieldError message={error} />
      </>
    );
  }

  return (
    <label className={className}>
      {label}
      {required ? ' *' : ''}
      {control}
      {hint ? <small className="meta-text">{hint}</small> : null}
      <FieldError message={error} />
    </label>
  );
}
