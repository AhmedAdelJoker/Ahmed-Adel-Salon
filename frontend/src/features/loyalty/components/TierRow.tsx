import { Percent, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";
import type { LoyaltyTier } from "@/types/loyalty";
import type { LoyaltyTierField } from "@/features/loyalty/hooks/useLoyaltySettings";

interface TierRowProps {
  tier: LoyaltyTier;
  index: number;
  canRemove: boolean;
  onChange: (index: number, field: LoyaltyTierField, value: string | number) => void;
  onRemove: (index: number) => void;
}

const labelCls = "text-[10px] font-bold uppercase tracking-wider text-muted";

export function TierRow({ tier, index, canRemove, onChange, onRemove }: TierRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-soft/40 p-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full shadow-sm", tier.color || "bg-accent")}
        />
        <div className="w-full space-y-1">
          <label className={labelCls}>اسم المستوى</label>
          <Input
            value={tier.name}
            onChange={(e) => onChange(index, "name", e.target.value)}
            className="h-11 rounded-xl bg-card font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:w-[300px]">
        <div className="space-y-1">
          <label className={labelCls}>الزيارات</label>
          <Input
            type="number"
            min={0}
            value={tier.min_visits}
            onChange={(e) => onChange(index, "min_visits", Number(e.target.value))}
            className="h-11 rounded-xl bg-card font-bold tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>خصم %</label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <Input
              type="number"
              min={0}
              value={tier.discount_percent}
              onChange={(e) => onChange(index, "discount_percent", Number(e.target.value))}
              className="h-11 rounded-xl bg-card pl-9 font-bold tabular-nums"
            />
          </div>
        </div>
      </div>

      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl text-danger hover:bg-danger/10"
          onClick={() => onRemove(index)}
          aria-label="حذف المستوى"
        >
          <Trash2 size={18} />
        </Button>
      )}
    </div>
  );
}
