import { Calendar, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/core/utils";

export interface MonthlyTargetProgressProps {
  monthlyTarget: number;
  currentMonthRevenue: number;
  targetProgress: number;
  monthStart: string;
  toDate: string;
  editingTarget: boolean;
  targetDraft: string;
  savingTarget: boolean;
  canEditTarget: boolean;
  /** When set, the card stays visible but dimmed with this explanation (e.g. range outside current month). */
  disabledReason?: string | null;
  onTargetDraftChange: (value: string) => void;
  onEditTarget: () => void;
  onCancelEditTarget: () => void;
  onSaveTarget: () => void;
}

export function MonthlyTargetProgress({
  monthlyTarget,
  currentMonthRevenue,
  targetProgress,
  monthStart,
  toDate,
  editingTarget,
  targetDraft,
  savingTarget,
  canEditTarget,
  disabledReason = null,
  onTargetDraftChange,
  onEditTarget,
  onCancelEditTarget,
  onSaveTarget,
}: MonthlyTargetProgressProps) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 sm:p-5">
        {disabledReason && (
          <p className="mb-3 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-[11px] font-bold text-muted">
            {disabledReason}
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                الهدف الشهري للإيرادات
              </p>
              {editingTarget ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={targetDraft}
                    onChange={(e) => onTargetDraftChange(e.target.value)}
                    className="h-9 w-36 rounded-xl border border-border bg-card px-3 text-sm font-black tabular-nums text-main outline-none focus:border-primary"
                    aria-label="الهدف الشهري"
                  />
                  <Button size="sm" onClick={onSaveTarget} loading={savingTarget} className="h-9 text-[11px] font-black">
                    حفظ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCancelEditTarget}
                    className="h-9 text-[11px] font-black"
                  >
                    إلغاء
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-main tabular-nums">
                    {formatCurrency(monthlyTarget)}
                  </p>
                  {canEditTarget && (
                    <button
                      type="button"
                      onClick={onEditTarget}
                      className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-black text-muted hover:text-primary print:hidden"
                    >
                      تعديل
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 sm:w-72">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-black text-main">
                {formatCurrency(currentMonthRevenue)} / {formatCurrency(monthlyTarget)}
              </span>
              <span className="text-sm font-black text-primary">{targetProgress.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-bold text-muted">
              {targetProgress >= 100
                ? "تم تحقيق الهدف! تجاوز بنسبة " + (targetProgress - 100).toFixed(1) + "%"
                : "متبقي " + formatCurrency(Math.max(0, monthlyTarget - currentMonthRevenue)) + " للوصول للهدف"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-muted">
            <Calendar size={12} />
            <span>منذ {monthStart.slice(5).replace("-", "/")} حتى {toDate.slice(5).replace("-", "/")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
