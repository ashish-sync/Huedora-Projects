import FieldError from './FieldError.jsx';
import { bindAutofillBlock } from '../../shared/suppressBrowserAutofill.js';

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
  const blockProps = autoComplete === 'off' ? bindAutofillBlock() : {};

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
      {...sharedProps}
      {...blockProps}
    />
  ) : (
    <input
      type="text"
      inputMode="email"
      autoCapitalize="none"
      {...sharedProps}
      {...blockProps}
      {...(autoComplete !== 'off' ? { autoComplete } : {})}
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
