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
    <div className="module-dash-kpis" role="group" aria-label="Summary">
      {items.map((item) => {
        const Comp = item.onClick ? 'button' : 'div';
        return (
          <Comp
            key={item.key || item.label}
            type={item.onClick ? 'button' : undefined}
            className={`module-kpi${item.active ? ' is-active' : ''}${item.onClick ? ' is-clickable' : ''}`}
            onClick={item.onClick}
          >
            <strong>{item.value ?? '—'}</strong>
            <span>{item.label}</span>
          </Comp>
        );
      })}
    </div>
  );
}

export function QuickActions({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="toolbar" style={{ marginBottom: '1rem' }}>
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
    <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {action}
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
}) {
  return (
    <div className={className}>
      <div className="topbar">
        <div className="topbar-copy">
          {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          <h2 className="topbar-title">{title}</h2>
          {description && (
            <p className="muted topbar-desc">{description}</p>
          )}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>

      {quickActions?.length > 0 && <QuickActions items={quickActions} />}
      {kpis?.length > 0 && <KpiGrid items={kpis} />}
      {toolbar && <div className="toolbar" style={{ marginBottom: '1rem' }}>{toolbar}</div>}
      {children}
    </div>
  );
}
