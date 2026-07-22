export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

export function paginateClientRows(rows = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const total = rows.length;
  const pages = Math.ceil(total / pageSize) || 1;
  const safePage = Math.min(Math.max(page, 1), pages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      limit: pageSize,
      total,
      pages,
    },
  };
}
