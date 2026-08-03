export default function MasterFilterShell({ children, actions, className = '' }) {
  const hasMain = Boolean(children);
  return (
    <div
      className={`master-filter-shell${hasMain ? '' : ' master-filter-shell--actions-only'}${className ? ` ${className}` : ''}`}
    >
      {hasMain ? <div className="master-filter-main">{children}</div> : null}
      {actions ? <div className="master-filter-actions">{actions}</div> : null}
    </div>
  );
}
