/** Catalog OffersPanel (moved from ServicesManagement page, no logic changes). */
import { Gift, Percent, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentPanel } from "@/components/shared/PremiumUI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isItemActive } from "@/features/catalog/constants";
import type { OfferRecord } from "@/types/catalog";

export default function OffersPanel({
  rows,
  onEdit,
  onDelete,
}: {
  rows: OfferRecord[];
  onEdit: (offer: OfferRecord) => void;
  onDelete: (id: number | string) => void;
}) {
  return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ContentPanel
            title="باقات العروض الترويجية"
            subtitle="إدارة الحزم التسويقية والخصومات الزمنية لزيادة معدل مبيعات الخدمات."
            noPadding
          >
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-soft/30">
                  <TableRow className="hover:bg-transparent border-border/40 h-16">
                    <TableHead className="font-black text-muted px-8 text-right text-[10px] uppercase tracking-[0.15em]">
                      العرض والوصف
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      السعر الجديد
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      الخصم الفعلي
                    </TableHead>
                    <TableHead className="font-black text-muted text-center text-[10px] uppercase tracking-[0.15em]">
                      الحالة
                    </TableHead>
                    <TableHead className="font-black text-muted text-left px-8 text-[10px] uppercase tracking-[0.15em]">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((offer) => (
                    <TableRow
                      key={offer.id}
                      className="group border-border/40 hover:bg-soft/40 transition-all duration-200"
                    >
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                            <Gift size={24} />
                          </div>
                          <div>
                            <div className="font-black text-main text-sm mb-1">
                              {offer.name_ar || offer.name}
                            </div>
                            <div className="text-[10px] font-bold text-muted line-clamp-1 max-w-[200px]">
                              {offer.description_ar ||
                                offer.description ||
                                "بدون وصف إضافي"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-lg font-black text-emerald-600 tracking-tighter tabular-nums">
                            {offer.offer_price}{" "}
                            <span className="text-[9px] font-bold mr-1">
                              ج.م
                            </span>
                          </div>
                          {offer.original_price && (
                            <div className="text-[10px] font-bold text-muted line-through opacity-60">
                              {offer.original_price} ج.م
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-black text-[11px] tabular-nums">
                          <Percent size={12} />
                          {offer.discount_percentage || 0}%
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isItemActive(offer) ? (
                          <Badge
                            variant="success"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            نشط
                          </Badge>
                        ) : (
                          <Badge
                            variant="danger"
                            className="px-4 rounded-full font-black text-[9px] uppercase tracking-widest"
                          >
                            معطل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-8">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(offer)}
                            className="h-10 w-10 rounded-xl text-muted hover:text-primary hover:bg-primary/5"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onDelete(offer.id as number | string)
                            }
                            className="h-10 w-10 rounded-xl text-muted hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ContentPanel>
        </div>
  );
}
