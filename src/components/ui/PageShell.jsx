import { Link } from 'react-router-dom';

export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <p className="eyebrow">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {i > 0 && (
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
          )}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </p>
  );
}

export function KpiGrid({ items = [] }) {
  if (!items.length) return null;
  return (
    <div
      className="module-dash-kpis"
      data-count={items.length}
      role="group"
      aria-label="Summary"
    >
      {items.map((item) => {
        const Comp = item.onClick ? 'button' : 'div';
        return (
          <Comp
            key={item.key || item.label}
            type={item.onClick ? 'button' : undefined}
            className={`module-kpi${item.active ? ' is-active' : ''}${item.onClick ? ' is-clickable' : ''}`}
            onClick={item.onClick}
          >
            <strong>{item.value ?? '-'}</strong>
            <span title={item.label}>{item.label}</span>
          </Comp>
        );
      })}
    </div>
  );
}

export function QuickActions({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="toolbar toolbar--page">
      {items.map((item) =>
        item.to ? (
          <Link key={item.label} to={item.to} className="btn secondary btn-compact">
            {item.label}
          </Link>
        ) : (
          <button key={item.label} type="button" className="btn secondary btn-compact" onClick={item.onClick}>
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state card">
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="muted empty-state-desc">{description}</p>}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export default function PageShell({
  breadcrumbs = [],
  title,
  description,
  actions,
  kpis,
  quickActions,
  toolbar,
  children,
  className = '',
  hideChrome = false,
}) {
  const showTopbar = !hideChrome && (title || breadcrumbs.length > 0 || description || actions);
  return (
    <div className={`page-shell${className ? ` ${className}` : ''}`}>
      {showTopbar ? (
        <div className="topbar">
          <div className="topbar-copy">
            {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
            {title ? <h2 className="topbar-title">{title}</h2> : null}
            {description && (
              <p className="muted topbar-desc">{description}</p>
            )}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      ) : null}

      {quickActions?.length > 0 && <QuickActions items={quickActions} />}
      {(kpis?.length > 0 || toolbar) && (
        <div className={`page-metrics${kpis?.length && toolbar ? ' page-metrics--split' : ''}`}>
          {kpis?.length > 0 && <KpiGrid items={kpis} />}
          {toolbar && <div className="toolbar toolbar--page page-metrics-toolbar">{toolbar}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
