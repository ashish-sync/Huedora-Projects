import { Pagination } from './Pagination';
import { DEFAULT_PAGE_SIZE, paginateClientRows } from '../constants/pagination';

export function ClientPaginatedTable({
  rows,
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'rows',
  renderTable,
}) {
  const { rows: pageRows, pagination } = paginateClientRows(rows, page, pageSize);

  if (!rows.length) return null;

  return (
    <>
      {renderTable(pageRows)}
      <Pagination
        pagination={pagination}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel={itemLabel}
      />
    </>
  );
}
