import { forwardRef } from 'react';

/**
 * Enterprise Form Input
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightElement,
    required = false,
    disabled = false,
    readOnly = false,
    className = '',
    containerClassName = '',
    id,
    type = 'text',
    ...rest
  },
  ref
) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`field ${containerClassName}`.trim()}>
      {label && (
        <label htmlFor={inputId}>
          {label}
          {required && <span className="field-required" aria-hidden="true"> *</span>}
        </label>
      )}

      <div className="field-control-wrap" style={{ position: 'relative', width: '100%' }}>
        {leftIcon && (
          <span
            className="field-icon-left"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-tertiary)',
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          readOnly={readOnly}
          className={`${error ? 'input-invalid' : ''} ${className}`.trim()}
          style={leftIcon ? { paddingLeft: '38px' } : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />

        {rightElement && (
          <span
            className="field-icon-right"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {rightElement}
          </span>
        )}
      </div>

      {error ? (
        <span id={`${inputId}-error`} className="field-error-text" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="field-hint-text">
          {hint}
        </span>
      ) : null}
    </div>
  );
});

export default Input;

