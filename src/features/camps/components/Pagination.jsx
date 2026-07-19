import { PAGE_SIZE_OPTIONS } from '../constants/pagination';
import { SelectDropdown } from './SelectDropdown';

export function Pagination({
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
}) {
  if (!pagination || pagination.total === 0) return null;

  const currentPageSize = pageSize || pagination.limit || PAGE_SIZE_OPTIONS[1];

  return (
    <div className="toolbar pagination-bar">
      <span className="meta-text">
        Page {pagination.page} of {pagination.pages} ({pagination.total} {itemLabel})
      </span>
      <div className="actions pagination-actions">
        <label className="page-size-control">
          Rows per page
          <SelectDropdown
            id={`page-size-${itemLabel}`}
            value={String(currentPageSize)}
            options={PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            onChange={(value) => onPageSizeChange(Number(value))}
            className="pagination-select"
            hideLabel
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pagination.page >= pagination.pages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
