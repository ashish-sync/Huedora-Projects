export default function MasterListHeader({ title, subtitle, actions, className = '' }) {
  if (!title && !subtitle && !actions) return null;

  return (
    <header className={`master-list-header${className ? ` ${className}` : ''}`}>
      <div>
        {title ? <h3 className="master-list-title">{title}</h3> : null}
        {subtitle ? <p className="muted master-list-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="master-list-header__actions">{actions}</div> : null}
    </header>
  );
}
