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
  actions = null,
}) {
  if (!items.length) return null;

  const navClass = [
    'module-sub-nav',
    variant === 'segmented' ? 'module-sub-nav--segmented' : 'module-sub-nav--bar',
    actions ? 'module-sub-nav--with-actions' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const links = items.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      role={item.role}
      className={({ isActive }) => `module-sub-nav__link${isActive ? ' is-active' : ''}`}
    >
      {item.label}
    </NavLink>
  ));

  return (
    <nav className={navClass} aria-label={ariaLabel} role={role}>
      {actions ? <div className="module-sub-nav__links">{links}</div> : links}
      {actions ? <div className="module-sub-nav__actions">{actions}</div> : null}
    </nav>
  );
}
