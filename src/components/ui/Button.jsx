import { forwardRef, useRef } from 'react';

/**
 * Enterprise Button Component
 *
 * Variants: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
 * Sizes: 'default' (38px standard) | 'compact' (32px standard)
 * Guards against double-submission during async actions via inFlightRef & loading lock.
 */
const Button = forwardRef(function Button(
  {
    children,
    type = 'button',
    variant = 'primary',
    size = 'default',
    loading = false,
    loadingText,
    icon,
    iconRight,
    disabled = false,
    className = '',
    onClick,
    title,
    'aria-label': ariaLabel,
    ...rest
  },
  ref
) {
  const inFlightRef = useRef(false);

  const handleClick = async (e) => {
    if (disabled || loading || inFlightRef.current) {
      e?.preventDefault?.();
      return;
    }

    if (onClick) {
      const result = onClick(e);
      // If the handler returned a promise, guard in-flight until settled
      if (result && typeof result.then === 'function') {
        inFlightRef.current = true;
        try {
          await result;
        } finally {
          inFlightRef.current = false;
        }
      }
    }
  };

  const variantClass = variant === 'primary' ? '' : variant;
  const sizeClass = size === 'compact' || size === 'sm' ? 'btn-compact' : '';
  const loadingClass = loading ? 'is-loading' : '';

  const classNames = [
    'btn',
    variantClass,
    sizeClass,
    loadingClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Tooltip / Accessibility fallback for icon-only buttons
  const isIconOnly = Boolean(icon && !children);
  const accessibleLabel = ariaLabel || title || (isIconOnly ? 'Action' : undefined);

  return (
    <button
      ref={ref}
      type={type}
      className={classNames}
      disabled={disabled || loading}
      onClick={handleClick}
      title={title || (isIconOnly ? accessibleLabel : undefined)}
      aria-label={accessibleLabel}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? (
        <span>{loadingText || children || 'Loading…'}</span>
      ) : (
        <>
          {icon && <span className="btn-icon btn-icon--left" aria-hidden="true">{icon}</span>}
          {children && <span className="btn-label">{children}</span>}
          {iconRight && <span className="btn-icon btn-icon--right" aria-hidden="true">{iconRight}</span>}
        </>
      )}
    </button>
  );
});

export default Button;

