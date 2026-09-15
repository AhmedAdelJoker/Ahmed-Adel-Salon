import type { ReactNode } from "react";
import {
  ArrowRight,
  Eye,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
} from "lucide-react";
import { ContentPanel } from "@/components/shared/PremiumUI";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/core/utils";
import type { TodayInvoice } from "@/features/cashier-dashboard/types";

export function highlightText(
  text: string | number | null | undefined,
  query: string,
): ReactNode {
  if (!query || !text) return text as ReactNode;
  const regex = new RegExp(`(${query})`, "gi");
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-primary/20 text-primary font-black rounded-sm px-0.5"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export interface TodayInvoicesListProps {
  invoices: TodayInvoice[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onArchive: () => void;
  onView: (invoice: TodayInvoice) => void;
  onPrint: (invoice: TodayInvoice) => void;
  onRequestAdjustment: (invoice: TodayInvoice) => void;
}

export function TodayInvoicesList({
  invoices,
  searchTerm,
  onSearchChange,
  onArchive,
  onView,
  onPrint,
  onRequestAdjustment,
}: TodayInvoicesListProps) {
  return (
    <ContentPanel className={undefined}
      title="إدارة مبيعات اليوم"
      subtitle="متابعة وتعديل فواتير اليوم بشكل سريع"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
              size={14}
            />
            <Input
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث برقم الفاتورة أو العميل..."
              className="pr-9 h-9 text-[11px] font-bold"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onArchive}
            className="text-[10px] font-black uppercase"
          >
            الأرشيف <ArrowRight size={14} className="mr-2 rotate-180" />
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="h-10 text-[10px] font-black uppercase">
                رقم الفاتورة
              </TableHead>
              <TableHead className="h-10 text-[10px] font-black uppercase">
                العميل
              </TableHead>
              <TableHead className="h-10 text-[10px] font-black uppercase">
                القيمة
              </TableHead>
              <TableHead className="h-10 text-[10px] font-black uppercase text-center">
                الدفع
              </TableHead>
              <TableHead className="h-10 text-[10px] font-black uppercase text-center">
                إجراءات
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length > 0 ? (
              invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="hover:bg-soft/50 transition-colors group"
                >
                  <TableCell className="py-3 font-black text-main tabular-nums text-xs">
                    #{highlightText(inv.invoice_no || inv.id, searchTerm)}
                  </TableCell>
                  <TableCell className="py-3 text-xs font-bold text-muted">
                    {highlightText(
                      inv.customer_name || "عميل عام",
                      searchTerm,
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-xs font-black text-primary tabular-nums">
                    {formatCurrency(inv.total_amount)}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <Badge
                      variant="secondary"
                      className="text-[8px] h-4 px-1.5 uppercase font-black"
                    >
                      {inv.payment_method === "cash" ? "نقدي" : "شبكة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:text-primary"
                        onClick={() => onView(inv)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:text-primary"
                        onClick={() => onPrint(inv)}
                      >
                        <Printer size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:text-warning"
                        onClick={() => onRequestAdjustment(inv)}
                      >
                        <ShieldCheck size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center opacity-50"
                >
                  <Receipt
                    size={32}
                    className="mx-auto text-muted mb-2"
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    لا توجد فواتير مطابقة
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ContentPanel>
  );
}
