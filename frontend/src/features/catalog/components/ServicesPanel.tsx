/** Catalog ServicesPanel (moved from ServicesManagement page, no logic changes). */
import { AlertTriangle, CheckCircle, Clock, Layers, Package, Pencil, Percent, Scissors, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
              label="متوسط الهامش"
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
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-soft/30">
                  <TableRow className="hover:bg-transparent border-border/40 h-16">
                    <TableHead className="font-black text-muted px-8 text-right text-[10px] uppercase tracking-[0.15em]">
                      الخدمة والوصف
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      التصنيف الفني
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      سعر البيع
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      التكلفة والربح
                    </TableHead>
                    <TableHead className="font-black text-muted text-right text-[10px] uppercase tracking-[0.15em]">
                      الوقت القياسي
                    </TableHead>
                    <TableHead className="font-black text-muted text-center text-[10px] uppercase tracking-[0.15em]">
                      الحالة التشغيلية
                    </TableHead>
                    <TableHead className="font-black text-muted text-left px-8 text-[10px] uppercase tracking-[0.15em]">
                      الإجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((service, _idx) => (
                    <TableRow
                      key={service.id}
                      className="group border-border/40 hover:bg-soft/40 transition-all duration-200"
                    >
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-soft flex items-center justify-center text-primary/40 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                            <Scissors size={20} />
                          </div>
                          <div>
                            <div className="font-black text-main text-sm leading-none mb-1.5">
                              {service.name_ar || service.name}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="h-5 px-1.5 rounded-md text-[8px] font-bold text-muted border-border/40"
                              >
                                ID: {service.id}
                              </Badge>
                              {(service.ingredients || []).length > 0 && (
                                <span className="text-[10px] font-bold text-primary/60">
                                  • {(service.ingredients || []).length} منتجات مربوطة
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="rounded-lg px-3 py-1.5 font-black text-[9px] uppercase tracking-widest bg-soft/50 border-none text-muted-foreground"
                        >
                          {service.category || "عام"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-lg font-black text-primary tracking-tighter tabular-nums">
                          {service.price}
                          <span className="text-[10px] text-muted font-bold mr-1 uppercase">
                            ج.م
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted w-12">
                              التكلفة:
                            </span>
                            <span className="text-xs font-black text-main tabular-nums">
                              {formatCurrency(
                                pricing.getServiceOperationalCost(service),
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted w-12">
                              الربح:
                            </span>
                            <span
                              className={cn(
                                "text-xs font-black tabular-nums px-1.5 rounded bg-opacity-10",
                                pricing.getServiceProfit(service) >= 0
                                  ? "text-emerald-600 bg-emerald-500"
                                  : "text-rose-600 bg-rose-500",
                              )}
                            >
                              {formatCurrency(pricing.getServiceProfit(service))}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-black text-main tabular-nums">
                          <Clock size={14} className="text-muted" />
                          {service.duration_minutes || 30}
                          <span className="text-[10px] text-muted font-bold mr-1">
                            دقيقة
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {isItemActive(service) ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                              <CheckCircle size={12} strokeWidth={3} /> متاحة
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full">
                              <XCircle size={12} strokeWidth={3} /> معطلة
                            </div>
                          )}
                          {pricing.getServiceLowStockCount(service) > 0 && (
                            <div className="flex items-center gap-1.5 text-amber-600 font-black text-[8px] uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-200/50">
                              <AlertTriangle size={10} /> نقص مخزون
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-8">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(service)}
                            className="h-10 w-10 rounded-xl text-muted hover:text-primary hover:bg-primary/5"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onDelete(service.id as number | string)
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
            {rows.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
                <div className="h-20 w-20 rounded-3xl bg-soft flex items-center justify-center mb-6">
                  <Scissors size={40} className="text-muted" />
                </div>
                <h4 className="text-lg font-black text-main uppercase tracking-widest">
                  لا توجد خدمات مطابقة
                </h4>
                <p className="text-xs font-bold text-muted mt-2">
                  جرب تعديل معايير البحث أو إضافة خدمة جديدة
                </p>
              </div>
            )}
          </ContentPanel>
        </div>
  );
}
