import PaginationBar from '../../../components/ui/PaginationBar.jsx';
import { PAGE_SIZE_OPTIONS } from '../constants/pagination';

/** @deprecated Prefer PaginationBar directly — thin wrapper for camp list pages. */
export function Pagination({
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  if (!pagination || pagination.total === 0) return null;

  const currentPageSize = pageSize || pagination.limit || PAGE_SIZE_OPTIONS[1];

  return (
    <PaginationBar
      page={pagination.page}
      limit={currentPageSize}
      total={pagination.total}
      pages={pagination.pages}
      pageSizes={PAGE_SIZE_OPTIONS}
      onPageChange={onPageChange}
      onLimitChange={onPageSizeChange}
    />
  );
}
