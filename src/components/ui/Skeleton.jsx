/**
 * Enterprise Skeleton Placeholder Component
 * Eliminates layout shifts (CLS) and provides subtle GPU-friendly loading shimmer.
 */
export default function Skeleton({
  variant = 'rect',
  width = '100%',
  height = '1rem',
  borderRadius,
  className = '',
  style = {},
  ...rest
}) {
  const radius =
    borderRadius ||
    (variant === 'circle'
      ? 'var(--radius-full, 9999px)'
      : variant === 'text'
      ? 'var(--radius-xs, 3px)'
      : 'var(--radius-sm, 6px)');

  const inlineStyle = {
    width,
    height: variant === 'text' && height === '1rem' ? '0.875rem' : height,
    borderRadius: radius,
    backgroundColor: 'var(--color-bg-sunken)',
    backgroundImage:
      'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-bg-hover) 85%, transparent), transparent)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.5s infinite linear',
    ...style,
  };

  return (
    <div
      className={`skeleton skeleton--${variant} ${className}`.trim()}
      style={inlineStyle}
      aria-hidden="true"
      {...rest}
    />
  );
}

Skeleton.Text = function SkeletonText({ lines = 3, gap = '8px', className = '' }) {
  return (
    <div className={`skeleton-text-group ${className}`.trim()} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
          height="0.875rem"
        />
      ))}
    </div>
  );
};

Skeleton.Card = function SkeletonCard({ height = '160px', className = '' }) {
  return (
    <div
      className={`card skeleton-card ${className}`.trim()}
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-card, 8px)',
      }}
    >
      <Skeleton width="40%" height="20px" />
      <Skeleton.Text lines={2} />
      <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
        <Skeleton width="80px" height="32px" />
      </div>
    </div>
  );
};

Skeleton.Table = function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div
      className={`table-wrap skeleton-table ${className}`.trim()}
      style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-card, 8px)',
        overflow: 'hidden',
        background: 'var(--color-bg-elevated)',
      }}
    >
      <table className="ops-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--color-bg-sunken)' }}>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '10px 14px' }}>
                <Skeleton width="70%" height="12px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ padding: '12px 14px' }}>
                  <Skeleton width={c === 0 ? '85%' : '60%'} height="14px" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

Skeleton.Kpi = function SkeletonKpi({ count = 3, className = '' }) {
  return (
    <div
      className={`module-dash-kpis ${className}`.trim()}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: '8px' }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="module-kpi"
          style={{
            padding: '12px 14px',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm, 6px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <Skeleton width="45%" height="22px" />
          <Skeleton width="70%" height="11px" />
        </div>
      ))}
    </div>
  );
};

