import FieldError from './FieldError.jsx';

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
    <textarea rows={rows} {...sharedProps} />
  ) : (
    <input type="email" autoComplete="email" {...sharedProps} />
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
