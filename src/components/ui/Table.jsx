/**
 * Enterprise Table Wrapper
 * Wraps ERP data tables in an accessible, horizontally scrolling viewport
 * with optional sticky headers and zero page breakage.
 */
export default function Table({
  children,
  className = '',
  stickyHeader = false,
  emptyMessage,
  isEmpty = false,
  loading = false,
  ...rest
}) {
  return (
    <div
      className={`table-wrap enterprise-table-wrap ${stickyHeader ? 'table-wrap--sticky' : ''} ${className}`.trim()}
      tabIndex={0}
      role="region"
      aria-label="Data Table Scroll Region"
      {...rest}
    >
      <table className="ops-data-table data-table">
        {children}
      </table>

      {isEmpty && !loading && (
        <div className="table-empty-notice" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <p>{emptyMessage || 'No records found.'}</p>
        </div>
      )}
    </div>
  );
}

