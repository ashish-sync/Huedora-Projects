export function CampRowIconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  variant = 'neutral',
  className = '',
  type = 'button',
}) {
  const classes = `camp-row-icon-btn camp-row-icon-btn--${variant}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`;

  return (
    <button
      type={type}
      className={classes}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
