import { Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildCampHireRequestPath } from '../utils/campHireRequest.js';

/**
 * Opens Request One with a Hiring Request for this camp.
 */
export function CampHireRequestButton({
  form,
  professions = [],
  disabled = false,
  className = '',
  variant = 'icon', // 'icon' | 'button'
  label = 'Raise hiring request',
}) {
  const navigate = useNavigate();

  function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || !form) return;
    navigate(buildCampHireRequestPath(form, { professions }));
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`btn secondary btn-compact camp-hire-request-btn ${className}`.trim()}
        onClick={handleClick}
        disabled={disabled}
        title={label}
      >
        <Briefcase size={15} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`camp-row-icon-btn camp-row-icon-btn--hire ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <span className="camp-row-icon-btn__glyph" aria-hidden="true">
        <Briefcase size={17} strokeWidth={2} />
      </span>
    </button>
  );
}
