/** Customers CustomerPagination (moved from Customers page, no logic changes). */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

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
  return (
          <div className="flex flex-col gap-3 border-t border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
            <div className="text-center text-xs font-bold text-gray-500 sm:text-right">
              عرض {filteredCount} من {totalCount}
            </div>
            <div className="flex items-center justify-center gap-3 sm:justify-end">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => onPage(Math.max(1, currentPage - 1))}
              >
                <ChevronRight size={18} />
              </Button>
              <span className="text-xs font-black">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() =>
                  onPage(Math.min(totalPages, currentPage + 1))
                }
              >
                <ChevronLeft size={18} />
              </Button>
            </div>
          </div>
  );
}
