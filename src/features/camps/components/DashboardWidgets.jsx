import { useEffect, useMemo, useState } from 'react';

export function ChartsEyeToggle({ showCharts, onToggle }) {
  const label = showCharts ? 'Hide charts' : 'Show charts';

  return (
    <button
      type="button"
      className={`charts-eye-toggle${showCharts ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={showCharts}
      data-tooltip={label}
    >
      {showCharts ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6.5c-4.2 0-7.9 2.6-9.4 6.5 1.5 3.9 5.2 6.5 9.4 6.5s7.9-2.6 9.4-6.5C19.9 9.1 16.2 6.5 12 6.5zm0 11c-2.5 0-4.5-2-4.5-4.5S9.5 8.5 12 8.5s4.5 2 4.5 4.5S14.5 17.5 12 17.5zm0-7c-1.4 0-2.5 1.1-2.5 2.5S10.6 15.5 12 15.5s2.5-1.1 2.5-2.5S13.4 10.5 12 10.5z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6.5c-4.2 0-7.9 2.6-9.4 6.5.4 1 .9 1.9 1.6 2.7l1.4-1.4c-.4-.6-.7-1.2-1-1.9 1.2-2.8 3.8-4.6 6.4-4.6 1.2 0 2.3.3 3.3.9l1.3-1.3C14.1 7 13.1 6.5 12 6.5zM21.7 20.3 4.4 3 3 4.4l2.7 2.7C3.6 8.8 2.2 10.5 1 12c1.7 4.3 6 7.5 11 7.5 2.1 0 4-.5 5.7-1.5l2.8 2.8 1.2-1.5zM12 17.5c-2.5 0-4.5-2-4.5-4.5 0-.8.2-1.5.5-2.1l6.1 6.1c-.6.3-1.3.5-2.1.5zm2.8-2.8L9.3 9.2c.6-.3 1.3-.5 2.1-.5 2.5 0 4.5 2 4.5 4.5 0 .8-.2 1.5-.5 2.1z" />
        </svg>
      )}
    </button>
  );
}

export function StatWidget({ label, value, onClick, compact = false }) {
  const className = [
    'widget-card',
    onClick ? 'widget-card-clickable' : '',
    compact ? 'widget-card-compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span>{label}</span>
        <strong>{value}</strong>
      </button>
    );
  }

  return (
    <div className={className}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function HierarchyCard({
  title,
  subtitle,
  total,
  items,
  onTotalClick,
  onItemClick,
  pageSize = 5,
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const visibleItems = items.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [items]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="panel hierarchy-card">
      <button type="button" className="hierarchy-card-header" onClick={onTotalClick}>
        <div>
          <p className="panel-subtitle">{subtitle}</p>
          <h3>{title}</h3>
        </div>
        <strong>{total}</strong>
      </button>
      {items.length > 0 ? (
        <>
          <ul className="hierarchy-list">
            {visibleItems.map((item) => (
              <li key={item.id || item.label}>
                <button type="button" onClick={() => onItemClick(item)}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              </li>
            ))}
          </ul>
          {items.length > pageSize && (
            <div className="hierarchy-pagination">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span className="hierarchy-page-meta">
                {start + 1}–{Math.min(start + pageSize, items.length)} of {items.length}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="hierarchy-empty">No camps in this range</p>
      )}
    </div>
  );
}

export function ChartPanel({ title, data = [], type = 'bar' }) {
  const max = useMemo(
    () => Math.max(1, ...data.map((row) => Number(row.value) || 0)),
    [data]
  );

  return (
    <div className="panel">
      <h3>{title}</h3>
      <div className="camp-ops-simple-chart" data-chart-type={type}>
        {data.length === 0 ? (
          <p className="hierarchy-empty">No chart data</p>
        ) : (
          <ul className="camp-ops-simple-chart-list">
            {data.map((row) => {
              const value = Number(row.value) || 0;
              const pct = Math.round((value / max) * 100);
              return (
                <li key={row.label || row.id}>
                  <span className="camp-ops-simple-chart-label" title={row.label}>{row.label}</span>
                  <span className="camp-ops-simple-chart-track">
                    <span
                      className={`camp-ops-simple-chart-bar${type === 'line' ? ' is-line' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <strong>{value}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AlertBadge({ alertLevel, alertReason }) {
  if (!alertLevel || alertLevel === 'none') return null;

  const labels = {
    reaction_required: 'Reaction required',
    weekend_attention: 'Weekend attention',
    off_hours: 'Off-hours',
  };

  return (
    <span className={`alert-pill alert-${alertLevel}`} title={alertReason || ''}>
      {labels[alertLevel]}
    </span>
  );
}

export function getCampRowClassName(camp) {
  if (camp.alertLevel === 'reaction_required') return 'camp-row-reaction';
  if (camp.alertLevel === 'weekend_attention') return 'camp-row-weekend';
  if (camp.alertLevel === 'off_hours') return 'camp-row-off-hours';
  if (camp.isOverdue) return 'camp-row-overdue';
  return '';
}

export function StatusBadge({ status }) {
  return <span className={`status-pill status-${status}`}>{status.replaceAll('_', ' ')}</span>;
}
