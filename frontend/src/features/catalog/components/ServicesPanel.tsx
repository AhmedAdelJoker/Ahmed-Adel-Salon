/** Catalog ServicesPanel (moved from ServicesManagement page, no logic changes). */
import { AlertTriangle, CheckCircle, Clock, Layers, Package, Pencil, Percent, Scissors, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPanel, StatCard } from "@/components/shared/PremiumUI";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/core/utils";
import { isItemActive } from "@/features/catalog/constants";
import type { ServiceRecord } from "@/types/catalog";
import type { CatalogSummary, PricingApi } from "@/features/catalog/utils/pricing";

export default function ServicesPanel({
  summary,
  rows,
  onEdit,
  onDelete,
  pricing,
}: {
  summary: CatalogSummary;
  rows: ServiceRecord[];
  onEdit: (service: ServiceRecord) => void;
  onDelete: (id: number | string) => void;
  pricing: PricingApi;
}) {
  return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              label="إجمالي الخدمات"
              value={summary.total}
              icon={Scissors}
              variant="info"
              delay={0.1}
            />
            <StatCard
              label="خدمات نشطة"
              value={summary.active}
              icon={Sparkles}
              variant="success"
              delay={0.2}
            />
            <StatCard
              label="الفئات الفنية"
              value={summary.categories}
              icon={Layers}
              variant="primary"
              delay={0.3}
            />
            <StatCard
              label="متوسط هامش النشط"
              value={`${summary.averageMargin.toFixed(1)}%`}
              icon={Percent}
              variant="warning"
              trend={summary.averageMargin > 40 ? "up" : "down"}
              trendValue={summary.averageMargin.toFixed(0)}
              delay={0.4}
            />
            <StatCard
              label="نقص مخزوني"
              value={summary.lowStock}
              icon={Package}
              variant="danger"
              delay={0.5}
            />
          </div>

          <ContentPanel
            title="لائحة الخدمات والأسعار المعتمدة"
            subtitle="عرض وتحليل أداء الخدمات، التكاليف التشغيلية، وهوامش الربح لكل عملية."
            noPadding
          >
            {rows.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center opacity-60">
                <div className="h-16 w-16 rounded-2xl bg-soft flex items-center justify-center mb-4">
                  <Scissors size={28} className="text-muted" />
                </div>
                <h4 className="text-sm font-black text-main">لا توجد خدمات مطابقة</h4>
                <p className="text-xs font-bold text-muted mt-1">
                  جرب تعديل معايير البحث أو إضافة خدمة جديدة
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table — single-line cells with tooltips, always-visible actions */}
                <div className="hidden lg:block overflow-x-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-soft/30">
                      <TableRow className="hover:bg-transparent border-border/40 h-12">
                        <TableHead className="font-black text-muted px-5 text-right text-[10px] tracking-widest whitespace-nowrap">
                          الخدمة
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          التصنيف
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          سعر البيع
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          التكلفة / الربح
                        </TableHead>
                        <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                          الوقت
                        </TableHead>
                        <TableHead className="font-black text-muted text-center text-[10px] tracking-widest whitespace-nowrap">
                          الحالة
                        </TableHead>
                        <TableHead className="font-black text-muted text-left px-5 text-[10px] tracking-widest whitespace-nowrap">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((service) => (
                        <TableRow
                          key={service.id}
                          className="group border-border/40 hover:bg-soft/30 transition-colors"
                        >
                          <TableCell className="px-5 py-4 max-w-[260px]">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-soft border border-border flex items-center justify-center text-primary/50 shrink-0">
                                <Scissors size={16} />
                              </div>
                              <div className="min-w-0">
                                <div
                                  className="font-black text-main text-sm leading-none truncate"
                                  title={(service.name_ar || service.name || "") as string}
                                >
                                  {service.name_ar || service.name}
                                </div>
                                {(service.ingredients || []).length > 0 && (
                                  <span className="text-[10px] font-bold text-primary/60">
                                    {(service.ingredients || []).length} منتجات مربوطة
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[140px]">
                            <span
                              className="inline-flex max-w-full truncate rounded-lg bg-soft border border-border px-2.5 py-1 text-[11px] font-bold text-muted"
                              title={(service.category || "عام") as string}
                            >
                              {service.category || "عام"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-sm font-black tabular-nums text-main">
                              {formatCurrency(service.price)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col gap-1 text-xs tabular-nums">
                              <span className="font-bold text-muted">
                                تكلفة {formatCurrency(pricing.getServiceOperationalCost(service))}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-black",
                                  pricing.getServiceProfit(service) >= 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200",
                                )}
                              >
                                ربح {formatCurrency(pricing.getServiceProfit(service))}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-soft border border-border px-2.5 py-1 text-xs font-black tabular-nums text-main">
                              <Clock size={12} className="text-muted" />
                              {service.duration_minutes || 30} دقيقة
                            </span>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              {isItemActive(service) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                  <CheckCircle size={11} strokeWidth={3} /> متاحة
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-soft border border-border px-2.5 py-1 text-[10px] font-black text-muted">
                                  <XCircle size={11} strokeWidth={3} /> معطلة
                                </span>
                              )}
                              {pricing.getServiceLowStockCount(service) > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[9px] font-black text-amber-700">
                                  <AlertTriangle size={10} /> نقص مخزون
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(service)}
                                className="h-8 w-8 rounded-xl border border-border bg-card text-muted hover:text-primary"
                                aria-label="تعديل الخدمة"
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete(service.id as number | string)}
                                className="h-8 w-8 rounded-xl border border-border bg-card text-muted hover:text-rose-600 hover:bg-rose-50"
                                aria-label="حذف الخدمة"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards — no overlap, two-line clamp + full actions */}
                <div className="grid gap-3 p-4 lg:hidden">
                  {rows.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-2xl border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-soft border border-border flex items-center justify-center text-primary/50 shrink-0">
                            <Scissors size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-main leading-tight line-clamp-2">
                              {service.name_ar || service.name}
                            </div>
                            <div className="text-[11px] font-bold text-muted truncate">
                              {service.category || "عام"}
                              {(service.ingredients || []).length > 0 &&
                                ` • ${(service.ingredients || []).length} منتجات`}
                            </div>
                          </div>
                        </div>
                        {isItemActive(service) ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-200 px-2 py-1 text-[10px] font-black text-emerald-700">
                            <CheckCircle size={11} /> متاحة
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-soft border px-2 py-1 text-[10px] font-black text-muted">
                            <XCircle size={11} /> معطلة
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-soft border border-border p-2.5">
                          <div className="text-[9px] font-black tracking-widest text-muted">سعر البيع</div>
                          <div className="text-sm font-black tabular-nums text-main mt-1">
                            {formatCurrency(service.price)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-soft border border-border p-2.5">
                          <div className="text-[9px] font-black tracking-widest text-muted">التكلفة</div>
                          <div className="text-sm font-black tabular-nums text-main mt-1">
                            {formatCurrency(pricing.getServiceOperationalCost(service))}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "rounded-xl border p-2.5",
                            pricing.getServiceProfit(service) >= 0
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-rose-50 border-rose-200",
                          )}
                        >
                          <div className="text-[9px] font-black tracking-widest text-muted">الربح</div>
                          <div
                            className={cn(
                              "text-sm font-black tabular-nums mt-1",
                              pricing.getServiceProfit(service) >= 0 ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {formatCurrency(pricing.getServiceProfit(service))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-soft border px-3 py-1.5 text-xs font-black tabular-nums text-main">
                          <Clock size={12} /> {service.duration_minutes || 30} دقيقة
                          {pricing.getServiceLowStockCount(service) > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[9px] mr-1">
                              <AlertTriangle size={10} /> نقص
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(service)}
                            className="h-9 rounded-xl px-4 text-xs font-black"
                          >
                            <Pencil size={14} className="ml-1" /> تعديل
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(service.id as number | string)}
                            className="h-9 w-9 rounded-xl border border-border text-muted hover:text-rose-600"
                            aria-label="حذف الخدمة"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ContentPanel>
        </div>
  );
}
