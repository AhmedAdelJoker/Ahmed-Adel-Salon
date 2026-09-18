/**
 * Invoices pagination — Phase 2: unified <Pagination /> component.
 *
 * Replaces the bespoke PageNumbers component with the shared design-token
 * driven Pagination primitive. Preserves the Arabic stats line.
 */
import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";

export interface InvoicesPaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
  invoicesCount: number;
  totalPages: number;
  onPageChange: Dispatch<SetStateAction<number>>;
}

export function InvoicesPagination({
  currentPage,
  pageSize,
  totalCount,
  filteredCount,
  invoicesCount,
  totalPages: _totalPages,
  onPageChange,
}: InvoicesPaginationProps) {
  // Stable paginator instance — mutate .total / .page on every render
  const paginator = useMemo(
    () =>
      createPaginationState({
        page: currentPage,
        size: pageSize,
        total: totalCount,
      }),
    [], // intentionally empty — we mutate via direct field assignment
  );
  paginator.total = totalCount;
  paginator.page = currentPage;
  paginator.size = pageSize;

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 px-3 py-2.5 sm:px-4 sm:py-3">
      <Pagination
        paginator={paginator}
        onPageChange={(p) => onPageChange(p)}
        showSizeChanger={false}
        locale="ar"
      />
      <p className="text-center text-[10px] font-bold text-muted sm:text-right">
        عرض{" "}
        <span className="tabular-nums">
          {filteredCount ? (currentPage - 1) * pageSize + 1 : 0}
        </span>{" "}
        -{" "}
        <span className="tabular-nums">
          {Math.min(currentPage * pageSize, totalCount || filteredCount)}
        </span>{" "}
        من{" "}
        <span className="tabular-nums">{totalCount || filteredCount}</span>
        {totalCount > filteredCount ? (
          <span className="text-[9px] text-muted/60">
            {" "}
            (الصفحة الحالية {filteredCount})
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Legacy PageNumbers export kept for backwards compatibility with any
 * importer — internally forwards to the unified Pagination component.
 */
export function PageNumbers(props: {
  currentPage: number;
  total: number;
  pageSize: number;
  onNavigate: (page: number) => void;
}) {
  const paginator = useMemo(
    () =>
      createPaginationState({
        page: props.currentPage,
        size: props.pageSize,
        total: props.total,
      }),
    [],
  );
  paginator.total = props.total;
  paginator.page = props.currentPage;
  paginator.size = props.pageSize;
  return (
    <Pagination
      paginator={paginator}
      onPageChange={props.onNavigate}
      showSizeChanger={false}
      locale="ar"
    />
  );
}
