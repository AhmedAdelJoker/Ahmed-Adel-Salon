/**
 * Pagination — Phase 2 unified pagination UI.
 *
 * Reads X-Total-Count / X-Page / X-Page-Size headers automatically when
 * the response is set via `setResponse()`. Falls back to props if needed.
 *
 * Usage:
 *   const [page, setPage] = useState(1);
 *   const [size, setSize] = useState(25);
 *   const paginator = useRef(new PaginationState()).current;
 *
 *   const response = await api.get("/customers", { params: { page, size } });
 *   paginator.setResponse(response);
 *
 *   return (
 *     <>
 *       <CustomerList items={response.data} />
 *       <Pagination paginator={paginator} onPageChange={setPage} />
 *     </>
 *   );
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useMemo } from "react";

export interface PaginationState {
  total: number;
  page: number;
  size: number;
  setResponse: (response: { headers?: Record<string, unknown>; data?: { total?: number } }) => void;
}

export function createPaginationState(initial: Partial<PaginationState> = {}): PaginationState {
  const state: PaginationState = {
    total: 0,
    page: 1,
    size: 25,
    setResponse: () => {},
    ...initial,
  };
  state.setResponse = (response) => {
    const h = response.headers ?? {};
    const totalRaw = h["x-total-count"] ?? h["X-Total-Count"];
    const pageRaw = h["x-page"] ?? h["X-Page"];
    const sizeRaw = h["x-page-size"] ?? h["X-Page-Size"];
    const total = totalRaw != null
      ? parseInt(String(totalRaw), 10)
      : (response.data?.total ?? 0);
    const page = pageRaw != null ? parseInt(String(pageRaw), 10) : 1;
    const size = sizeRaw != null ? parseInt(String(sizeRaw), 10) : 25;
    state.total = Number.isFinite(total) ? total : 0;
    state.page = Number.isFinite(page) ? page : 1;
    state.size = Number.isFinite(size) ? size : 25;
  };
  return state;
}

interface PaginationProps {
  /** Pagination state — pass `createPaginationState()` */
  paginator: PaginationState;
  /** Called when user clicks a page number / prev / next / first / last */
  onPageChange: (page: number) => void;
  /** Called when user changes the page size */
  onSizeChange?: (size: number) => void;
  /** Page size options (default: [10, 25, 50, 100]) */
  sizeOptions?: number[];
  /** Show the page size selector */
  showSizeChanger?: boolean;
  /** Position of the size selector */
  sizePosition?: "left" | "right";
  /** Optional extra className for the wrapper */
  className?: string;
  /** Locale for labels (default: "ar") */
  locale?: "ar" | "en";
}

const LABELS_AR = {
  prev: "السابق",
  next: "التالي",
  first: "الأولى",
  last: "الأخيرة",
  page: "صفحة",
  of: "من",
  total: "إجمالي",
  rows: "صفوف",
  showing: "عرض",
};

const LABELS_EN = {
  prev: "Previous",
  next: "Next",
  first: "First",
  last: "Last",
  page: "Page",
  of: "of",
  total: "Total",
  rows: "rows",
  showing: "Showing",
};

export function Pagination({
  paginator,
  onPageChange,
  onSizeChange,
  sizeOptions = [10, 25, 50, 100],
  showSizeChanger = true,
  sizePosition = "right",
  className = "",
  locale = "ar",
}: PaginationProps) {
  const labels = locale === "ar" ? LABELS_AR : LABELS_EN;
  const { total, page, size } = paginator;
  const totalPages = Math.max(1, Math.ceil(total / size));

  // Compute the window of visible page numbers: first, last, current±2
  const pages = useMemo<number[]>(() => {
    const set = new Set<number>();
    // Always show first & last
    set.add(1);
    set.add(totalPages);
    // Show current ± 2
    for (let p = page - 2; p <= page + 2; p++) {
      if (p >= 1 && p <= totalPages) set.add(p);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [page, totalPages]);

  const start = total === 0 ? 0 : (page - 1) * size + 1;
  const end = Math.min(page * size, total);

  if (total === 0) {
    return null; // Don't render if no data
  }

  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    if (onSizeChange) onSizeChange(newSize);
  };

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={`flex flex-wrap items-center justify-between gap-3 px-2 py-3 ${className}`}
    >
      {/* Left side: size selector */}
      {showSizeChanger && sizePosition === "left" && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <label htmlFor="pagination-size" className="font-bold">
            {labels.rows}:
          </label>
          <select
            id="pagination-size"
            value={size}
            onChange={handleSizeChange}
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-bold text-main focus-ring"
          >
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Middle: stats */}
      <div className="text-xs text-muted truncate-1">
        {labels.showing} <span className="font-bold text-main">{start}</span>–
        <span className="font-bold text-main">{end}</span> {labels.of}{" "}
        <span className="font-bold text-main">{total}</span>
      </div>

      {/* Right side: page buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <PageBtn
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label={labels.first}
        >
          {locale === "ar" ? <ChevronRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </PageBtn>

        {/* Previous */}
        <PageBtn
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label={labels.prev}
        >
          <ChevronRight className="h-4 w-4" />
        </PageBtn>

        {/* Page numbers */}
        {pages.map((p, i) => {
          const prev = pages[i - 1];
          const gap = prev != null && p - prev > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {gap && (
                <span className="px-1 text-xs text-muted" aria-hidden="true">
                  …
                </span>
              )}
              <PageBtn
                onClick={() => onPageChange(p)}
                active={p === page}
                aria-label={`${labels.page} ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </PageBtn>
            </span>
          );
        })}

        {/* Next */}
        <PageBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label={labels.next}
        >
          <ChevronLeft className="h-4 w-4" />
        </PageBtn>

        {/* Last page */}
        <PageBtn
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label={labels.last}
        >
          {locale === "ar" ? <ChevronLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </PageBtn>
      </div>

      {/* Right: size selector */}
      {showSizeChanger && sizePosition === "right" && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <label htmlFor="pagination-size-right" className="font-bold">
            {labels.rows}:
          </label>
          <select
            id="pagination-size-right"
            value={size}
            onChange={handleSizeChange}
            className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-bold text-main focus-ring"
          >
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
  ...ariaProps
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "focus-ring inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-bold transition-colors",
        active
          ? "bg-primary text-inverse shadow-soft"
          : disabled
            ? "cursor-not-allowed text-muted/40"
            : "text-main hover:bg-soft",
      ]
        .filter(Boolean)
        .join(" ")}
      {...ariaProps}
    >
      {children}
    </button>
  );
}
