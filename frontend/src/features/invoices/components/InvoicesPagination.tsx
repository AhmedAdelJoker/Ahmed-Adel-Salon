/**
 * Invoices pagination — one source of truth.
 *
 * The old version rendered the shared <Pagination /> stats and then repeated
 * them in a second Arabic line ("عرض 1 - 20 من 23 (الصفحة الحالية 20)").
 */
import { useMemo } from "react";
import {
  Pagination,
  createPaginationState,
} from "@/components/shared/Pagination";

export interface InvoicesPaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function InvoicesPagination({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
}: InvoicesPaginationProps) {
  const paginator = useMemo(
    () =>
      createPaginationState({
        page: currentPage,
        size: pageSize,
        total: totalCount,
      }),
    [],
  );
  paginator.total = totalCount;
  paginator.page = currentPage;
  paginator.size = pageSize;

  if (totalCount === 0) return null;

  return (
    <div className="border-t border-border/60 px-2 py-1.5">
      <Pagination
        paginator={paginator}
        onPageChange={onPageChange}
        showSizeChanger={false}
        locale="ar"
      />
    </div>
  );
}
