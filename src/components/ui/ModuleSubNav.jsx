import { NavLink } from 'react-router-dom';

/**
 * Shared module section navigation — bar (under page title) or segmented (inline pill group).
 */
export default function ModuleSubNav({
  items = [],
  ariaLabel = 'Sections',
  variant = 'bar',
  className = '',
  role,
}) {
  if (!items.length) return null;

  const navClass = [
    'module-sub-nav',
    variant === 'segmented' ? 'module-sub-nav--segmented' : 'module-sub-nav--bar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav className={navClass} aria-label={ariaLabel} role={role}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          role={item.role}
          className={({ isActive }) => `module-sub-nav__link${isActive ? ' is-active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
