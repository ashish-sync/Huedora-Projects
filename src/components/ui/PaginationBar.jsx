import { PAGE_SIZES } from '../../shared/validation.js';

/**
 * Standard list footer: rows per page, total records, page X of Y, prev/next.
 */
export default function PaginationBar({
  page = 1,
  limit = 25,
  total = 0,
  pages = 0,
  loading = false,
  pageSizes = PAGE_SIZES,
  onPageChange,
  onLimitChange,
}) {
  const safePages = Math.max(Number(pages) || 0, total > 0 ? 1 : 0);
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 25);
  const safeTotal = Math.max(0, Number(total) || 0);
  const from = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const to = Math.min(safePage * safeLimit, safeTotal);

  return (
    <footer className="inv-pagination">
      <div className="inv-pagination-meta">
        <span>
          Showing {from}–{to} of {safeTotal.toLocaleString()} records
          {safePages > 0 ? ` · ${safePages.toLocaleString()} page${safePages === 1 ? '' : 's'}` : ''}
        </span>
        <label className="inv-page-size">
          <span className="inv-page-size-label">Records per page</span>
          <select
            className="tylo-select inv-page-size-select"
            value={safeLimit}
            onChange={(e) => onLimitChange?.(Number(e.target.value))}
            disabled={loading}
            aria-label="Records per page"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="inv-pagination-controls">
        <button
          type="button"
          className="btn secondary btn-compact"
          disabled={safePage <= 1 || loading || safeTotal === 0}
          onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
        >
          Previous
        </button>
        <span className="inv-page-indicator">
          Page {safePage} of {Math.max(safePages, 1)}
        </span>
        <button
          type="button"
          className="btn secondary btn-compact"
          disabled={safePage >= safePages || loading || safeTotal === 0}
          onClick={() => onPageChange?.(safePage + 1)}
        >
          Next
        </button>
      </div>
    </footer>
  );
}
