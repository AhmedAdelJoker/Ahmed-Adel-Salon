import { AlertOctagon, AlertTriangle, ArrowLeft, Bell, CheckCircle2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { useNeedsAttention } from "@/features/reports-dashboard/hooks/useNeedsAttention";

export interface NeedsAttentionProps {
  onNavigate: (href: string) => void;
}

/**
 * "What needs you" at the top of `/owner`.
 *
 * The dashboard answered "how did we do" and the alerts page answered "what is
 * pending", but the question an owner actually opens the dashboard with is
 * "what do I have to deal with today". That required navigating to a second page
 * to find out, and the quick-action strip offered only four of the eighteen
 * destinations in the owner nav.
 *
 * Reads `/owner/alerts` -- the same aggregate the alerts page renders -- so the
 * count here and the list there are the same fact, not two implementations that
 * drift.
 *
 * The empty state is a real state. When there is nothing pending it says so and
 * says it plainly, because a dashboard that cannot report "nothing is wrong" is
 * a dashboard nobody trusts on the days it matters.
 */
export function NeedsAttention({ onNavigate }: NeedsAttentionProps) {
  const { alerts, counts, loading, error, reload } = useNeedsAttention(4);

  if (loading) {
    return (
      <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
        <div className="flex items-center gap-2 px-5 pt-5">
          <span className="text-[10px] font-black tracking-widest text-muted uppercase">
            يحتاج انتباهك
          </span>
        </div>
        <div className="p-5">
          <SkeletonCard variant="content" className={undefined} />
        </div>
      </PremiumCard>
    );
  }

  // Shown instead of the card body, not in addition to it. An error next to a
  // zero count is a contradiction the reader has to resolve, and the wrong
  // resolution is "no problems".
  if (error) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 flex flex-wrap items-center gap-3 text-danger">
        <AlertTriangle size={18} className="shrink-0" />
        <p className="text-xs font-bold flex-1 min-w-[200px]">
          {error} — لم يتم تأكيد وجود أو عدم وجود بنود تنتظرك.
        </p>
        <Button variant="outline" size="sm" onClick={reload} className="shrink-0">
          <RefreshCw size={14} className="ms-1.5" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (counts.total === 0) {
    return (
      <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-sm font-black text-main">لا يوجد ما ينتظرك</p>
              <p className="text-xs text-muted">
                لا طلبات موافقة، ولا مستندات منتهية، ولا نقص مخزون، ولا إشعارات
                غير مقروءة.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث">
            <RefreshCw size={14} />
          </Button>
        </div>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard className="p-0 overflow-hidden" hoverable={false} animate={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <Bell size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-main">يحتاج انتباهك</p>
            <p className="text-[10px] font-bold text-muted">
              {counts.total === 1
                ? "بند واحد بانتظارك"
                : `${counts.total} بنود بانتظارك`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CountPill label="حرجة" value={counts.high} tone="danger" />
          <CountPill label="مراجعة" value={counts.medium} tone="warning" />
          <CountPill label="معلومة" value={counts.low} tone="info" />
          <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {alerts.map((alert) => (
          <li key={alert.key}>
            <button
              type="button"
              onClick={() => onNavigate(alert.destination)}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-right transition-colors hover:bg-soft group"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  alert.priority === "high"
                    ? "bg-danger"
                    : alert.priority === "medium"
                      ? "bg-warning"
                      : "bg-info",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-main group-hover:text-accent transition-colors">
                  {alert.title}
                </span>
                {alert.message && (
                  <span className="block truncate text-[11px] text-muted">
                    {alert.message}
                  </span>
                )}
              </span>
              <ArrowLeft
                size={14}
                className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>

      {counts.total > alerts.length && (
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => onNavigate("/owner/alerts")}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-accent hover:underline"
          >
            <AlertOctagon size={12} />
            عرض {counts.total - alerts.length} بنداً آخر
          </button>
        </div>
      )}
    </PremiumCard>
  );
}

function CountPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info";
}) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
  };

  // Zero is not rendered as a pill. An empty "0 critical" badge is noise that
  // reads as a category that exists.
  if (value === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black",
        tones[tone],
      )}
    >
      {value}
      <span className="opacity-80">{label}</span>
    </span>
  );
}