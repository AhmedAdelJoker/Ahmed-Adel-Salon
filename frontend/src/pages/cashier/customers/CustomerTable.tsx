import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getInitials } from "@/lib/core/utils";
import { SortAsc, SortDesc, Edit3 } from "lucide-react";
import {
  customerId,
  customerName,
  getTierLabel,
  getTierVariant,
} from "@/pages/cashier/customers/useCustomers";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Users, History } from "lucide-react";

export function CustomerTable({
  sortedCustomers,
  sortField,
  sortOrder,
  onSort,
  onDetails,
  onEdit,
  onDelete,
}: any) {
  function renderSortIcon(field) {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />;
  }

  return (
    <div className="hidden lg:block overflow-x-auto custom-scrollbar">
      <Table className="min-w-[60rem]">
        <TableHeader>
          <TableRow className="border-b border-border bg-soft/50 hover:bg-soft/50">
            <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted w-[30%]">
              <button
                onClick={() => onSort("name")}
                className="flex items-center gap-1 hover:text-accent transition-colors"
              >
                ملف العميل {renderSortIcon("name")}
              </button>
            </TableHead>
            <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted w-[18%]">
              <button
                onClick={() => onSort("phone")}
                className="flex items-center gap-1 hover:text-accent transition-colors"
              >
                رقم التواصل {renderSortIcon("phone")}
              </button>
            </TableHead>
            <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted w-[20%]">
              <button
                onClick={() => onSort("visits")}
                className="flex items-center gap-1 hover:text-accent transition-colors"
              >
                الزيارات والولاء {renderSortIcon("visits")}
              </button>
            </TableHead>
            <TableHead className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted w-[17%]">
              <button
                onClick={() => onSort("spend")}
                className="flex items-center gap-1 justify-center hover:text-accent transition-colors"
              >
                الإنفاق {renderSortIcon("spend")}
              </button>
            </TableHead>
            <TableHead className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted w-[15%]">
              الإجراءات
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCustomers.map((customer, index) => (
            <TableRow
              key={customerId(customer) || index}
              className="cursor-pointer border-b border-border/40 hover:bg-soft/30 transition-colors"
              onClick={() => onDetails(customer)}
            >
              <TableCell className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-sm font-black text-accent">
                    {getInitials(customerName(customer))}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-main truncate">
                      {customerName(customer)}
                    </div>
                    <div className="text-[10px] font-bold text-muted">
                      #{customerId(customer) || "---"}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell
                className="px-6 py-4 text-sm font-black text-main"
                dir="ltr"
              >
                <div>{customer.phone || "---"}</div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <div className="flex flex-col gap-1.5">
                  <Badge
                     
                    variant={
                      ((customer.visits_count || 0) > 10
                        ? ("accent" as any)
                        : (customer.visits_count || 0) >= 2
                          ? "info"
                          : "outline") as any
                    }
                    className="w-fit text-[10px]"
                  >
                    {customer.visits_count || 0} زيارة
                  </Badge>
                  <Badge
                    variant={getTierVariant(customer)}
                    className="w-fit text-[10px]"
                  >
                    {getTierLabel(customer)}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-black text-emerald-600 text-sm">
                    {formatCurrency(customer.lifetime_spend || 0)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700">
                    <Star size={9} className="fill-current" />{" "}
                    {Number(customer.loyalty_points || 0).toFixed(0)} نقطة
                  </span>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <div className="flex justify-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDetails(customer);
                    }}
                    aria-label="عرض التفاصيل"
                  >
                    <History size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(customer);
                    }}
                    aria-label="تعديل العميل"
                  >
                    <Edit3 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-rose-600 hover:bg-rose-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(customer);
                    }}
                    aria-label="حذف العميل"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sortedCustomers.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-24 text-center">
                <div className="flex flex-col items-center gap-3 text-muted/40">
                  <Users size={48} strokeWidth={1} />
                  <p className="text-sm font-bold">لا يوجد عملاء مطابقين</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
