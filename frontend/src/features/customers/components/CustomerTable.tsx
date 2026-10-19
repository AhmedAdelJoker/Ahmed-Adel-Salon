/** Customers CustomerTable (moved from Customers page, no logic changes). */
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  History,
  Trash2,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  customerId,
  customerName,
  getInitials,
  secondPhone,
  getTierInfo,
} from "@/features/customers/utils/customer";
import { EmptyState } from "@/components/shared/EmptyState";

const SORT_ACCESSORS: Record<string, (c: any) => number | string> = {
  name: (c) => customerName(c),
  id: (c) => Number(customerId(c) || 0),
  visits: (c) => Number(c.visits_count || c.visits || 0),
  spend: (c) => Number(c.lifetime_spend || c.total_spend || c.totalSpend || 0),
};

export default function CustomerTable({
  rows,
  loading,
  isOwner,
  onOpenDetails,
  onNavigate,
  onDelete,
  emptyTitle = "لا يوجد عملاء مطابقين",
  emptyHint,
  showClearFilter = false,
  onClearFilter,
}: {
  rows: any[];
  loading: boolean;
  isOwner: boolean;
  onOpenDetails: (customer: any) => void;
  onNavigate: (id: number | string) => void;
  onDelete: (customer: any) => void;
  emptyTitle?: string;
  emptyHint?: string;
  showClearFilter?: boolean;
  onClearFilter?: () => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey || !SORT_ACCESSORS[sortKey]) return rows;
    const accessor = SORT_ACCESSORS[sortKey];
    return [...rows].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      const cmp =
        typeof va === "string" || typeof vb === "string"
          ? String(va).localeCompare(String(vb), "ar")
          : va - vb;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ label, sort }: { label: string; sort?: string }) => (
    <th className="px-4 py-3" aria-sort={
      sort && sortKey === sort
        ? sortDir === "asc"
          ? "ascending"
          : "descending"
        : "none"
    }>
      {sort ? (
        <button
          type="button"
          onClick={() => toggleSort(sort)}
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted transition-colors hover:text-main"
        >
          {label}
          {sortKey === sort ? (
            sortDir === "asc" ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )
          ) : (
            <ChevronsUpDown size={12} className="opacity-40" />
          )}
        </button>
      ) : (
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          {label}
        </span>
      )}
    </th>
  );

  return (
          <div className="scroll-x">
            <table className="min-w-[52rem] w-full text-right">
              <thead>
                <tr className="border-b border-border bg-soft">
                  <SortHeader label="ملف العميل" sort="name" />
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">
                    رقم التواصل
                  </th>
                  <SortHeader label="الزيارات" sort="visits" />
                  <SortHeader label="الإنفاق" sort="spend" />
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedRows.map((customer, index) => {
                  const tier = getTierInfo(customer.current_tier);
                    const visits = Number(customer.visits_count || customer.visits || 0);
                    const visitsVariant: "warning" | "info" | "outline" =
                      visits > 10 ? "warning" : visits >= 2 ? "info" : "outline";
                  return (
                  <tr
                    key={customerId(customer) || index}
                    className={cn(
                      "cursor-pointer transition hover:bg-soft/60",
                      loading && "pointer-events-none opacity-50",
                    )}
                    onClick={() => onOpenDetails(customer)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                          {getInitials(customerName(customer))}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-main">
                              {customerName(customer)}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[8px] font-black",
                                tier.bg,
                                tier.color,
                              )}
                            >
                              <tier.icon size={9} /> {tier.label}
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-muted">
                            #{customerId(customer) || "---"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-black" dir="ltr">
                      <div className="text-main">{customer.phone || "---"}</div>
                      {secondPhone(customer) ? (
                        <div className="mt-0.5 text-[10px] font-bold text-muted">
                          {secondPhone(customer)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={visitsVariant}>
                        {visits} زيارة
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-black text-success">
                      {formatCurrency(
                        customer.lifetime_spend ||
                          customer.total_spend ||
                          customer.totalSpend ||
                          0,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        <Button
                          variant="primary"
                          size="icon"
                          title="عرض الملف"
                          onClick={(event) => {
                            event.stopPropagation();
                            onNavigate(customerId(customer));
                          }}
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          title="فتح سريع"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDetails(customer);
                          }}
                        >
                          <History size={16} />
                        </Button>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-danger hover:text-danger"
                            title="أرشفة"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(customer);
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6">
                      <EmptyState
                        title={emptyTitle}
                        message={emptyHint}
                        variant="section"
                        action={
                          showClearFilter && onClearFilter ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onClearFilter}
                              className="mt-2 rounded-xl text-xs font-black"
                            >
                              مسح البحث والفلتر
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
  );
}
