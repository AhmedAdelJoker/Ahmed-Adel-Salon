/**
 * Customers pagination — Phase 2: unified <Pagination /> component.
 *
 * Reads X-Total-Count from the upstream response and reuses the design
 * tokens shared with the rest of the app.
 */
import { useMemo } from "react";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import { CUSTOMERS_PAGE_SIZE } from "@/features/customers/constants";

export default function CustomerPagination({
  currentPage,
  totalPages,
  totalCount,
  filteredCount,
  onPage,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  filteredCount: number;
  onPage: (page: number) => void;
}) {
  // Stable paginator instance — we only need .total for display
  // (page navigation is handled by parent via onPage).
  const paginator = useMemo(
    () => createPaginationState({ page: currentPage, size: CUSTOMERS_PAGE_SIZE, total: totalCount }),
    [],
  );
  // Mutate the paginator's totals so <Pagination /> renders the correct window.
  paginator.total = totalCount;
  paginator.page = currentPage;
  paginator.size = CUSTOMERS_PAGE_SIZE;

  return (
    <div className="card-surface mt-4 rounded-2xl px-2 sm:px-4">
      <Pagination
        paginator={paginator}
        onPageChange={onPage}
        showSizeChanger={false}
        sizePosition="right"
        locale="ar"
      />
      <div className="px-3 pb-2 text-center text-[10px] text-muted sm:text-right">
        عرض {filteredCount} من {totalCount} — صفحة {currentPage} / {totalPages}
      </div>
    </div>
  );
}
