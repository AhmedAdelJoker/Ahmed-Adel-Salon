import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

export interface PageNumbersProps {
  currentPage: number;
  total: number;
  pageSize: number;
  onNavigate: (page: number) => void;
}

export function PageNumbers({ currentPage, total, pageSize, onNavigate }: PageNumbersProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const items: (number | string)[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (pageCount > 7 && i > 3 && i < pageCount - 2) {
      if (!items.includes("…")) items.push("…");
      i = pageCount - 3;
      continue;
    }
    items.push(i);
  }
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {items.map((item, idx) =>
        item === "…" ? (
          <span
            key={`d-${idx}`}
            className="px-0.5 text-[10px] font-black text-muted sm:px-1 sm:text-xs"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onNavigate(item as number)}
            className={cn(
              "h-8 min-w-7 rounded-lg px-1.5 text-[10px] font-black transition-all sm:h-9 sm:min-w-9 sm:px-2 sm:text-[11px]",
              item === currentPage
                ? "bg-primary text-white shadow-sm"
                : "bg-soft text-muted hover:bg-card hover:text-main",
            )}
          >
            {item}
          </button>
        ),
      )}
    </div>
  );
}

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
  totalPages,
  onPageChange,
}: InvoicesPaginationProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
      <p className="text-[10px] font-bold text-muted sm:text-xs">
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
        {totalCount > filteredCount ? <span className="text-[9px] text-muted/60"> (الصفحة الحالية {filteredCount})</span> : null}
      </p>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-2.5 text-[10px] sm:h-9 sm:px-3"
          onClick={() => onPageChange((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          السابق
        </Button>
        <PageNumbers
          currentPage={currentPage}
          total={totalCount || filteredCount}
          pageSize={pageSize}
          onNavigate={onPageChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-2.5 text-[10px] sm:h-9 sm:px-3"
          onClick={() => onPageChange((p) => p + 1)}
          disabled={currentPage >= totalPages || invoicesCount < pageSize}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
