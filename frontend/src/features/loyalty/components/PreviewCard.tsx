import { Zap } from "lucide-react";

import { PremiumCard } from "@/components/shared/PremiumUI";
import { formatNumber } from "@/lib/core/utils";
import type { LoyaltySettings } from "@/types/loyalty";
import {
  LOYALTY_PREVIEW,
  pointsForAmount,
  tierForVisits,
  valueForPoints,
} from "@/features/loyalty/utils/loyaltyHelpers";

function trimNum(n: number): string {
  return Number.isInteger(n) ? formatNumber(n) : String(Number(n.toFixed(1)));
}

interface PreviewCardProps {
  settings: LoyaltySettings;
}

/** معاينة فورية لأثر القواعد الحالية قبل الحفظ */
export function PreviewCard({ settings }: PreviewCardProps) {
  const points = pointsForAmount(settings, LOYALTY_PREVIEW.amount);
  const value = valueForPoints(settings, points);
  const tier = tierForVisits(settings, LOYALTY_PREVIEW.visits);
  const ladder = [...settings.tiers].sort((a, b) => a.min_visits - b.min_visits);

  return (
    <PremiumCard hoverable={false} className="space-y-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
        <Zap size={14} className="text-accent" /> معاينة حية
      </div>

      <div className="space-y-2 text-sm font-bold leading-relaxed text-main">
        <p className="tabular-nums">
          فاتورة {formatNumber(LOYALTY_PREVIEW.amount)} ج ←{" "}
          <span className="text-accent">{trimNum(points)} نقطة</span> ← {trimNum(value)} ج رصيد
        </p>
        <p className="tabular-nums">
          الزيارة {formatNumber(LOYALTY_PREVIEW.visits)} ←{" "}
          {tier ? (
            <span className="text-accent">
              {tier.name} • خصم {trimNum(tier.discount_percent)}%
            </span>
          ) : (
            "لا مستوى"
          )}
        </p>
      </div>

      {settings.points_expiry_months > 0 && (
        <p className="text-[11px] font-bold text-muted">
          النقاط تنتهي بعد {trimNum(settings.points_expiry_months)} شهر من آخر كسب
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
        {ladder.map((t) => (
          <span
            key={`${t.name}-${t.min_visits}`}
            className="rounded-full bg-soft px-2.5 py-1 text-[10px] font-bold tabular-nums text-muted"
          >
            {t.min_visits}+ {t.name}
            {t.discount_percent > 0 ? ` • ${t.discount_percent}%` : ""}
          </span>
        ))}
      </div>
    </PremiumCard>
  );
}
