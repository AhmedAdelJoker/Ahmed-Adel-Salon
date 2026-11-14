import { Activity, Gift, Plus, Save, ShieldCheck, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ContentPanel, PageHeader, SkeletonCard } from "@/components/shared/PremiumUI";
import { PreviewCard } from "@/features/loyalty";
import { TierRow } from "@/features/loyalty";
import { LOYALTY_LIMITS, useLoyaltySettings } from "@/features/loyalty";
import { useTranslation } from "react-i18next";

const labelCls = "text-[10px] font-bold uppercase tracking-wider text-muted";
const hintCls = "text-[10px] font-medium text-muted";

export default function LoyaltySettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("owner");
  const {
    settings,
    loading,
    saving,
    setEnabled,
    setRule,
    updateTier,
    addTier,
    removeTier,
    save,
  } = useLoyaltySettings();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-soft" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <SkeletonCard variant="content" className="xl:col-span-8" />
          <div className="space-y-6 xl:col-span-4">
            <SkeletonCard variant="content" />
            <SkeletonCard variant="content" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${embedded ? "" : "animate-in fade-in slide-in-from-bottom-4"}`}>
      {!embedded ? (
        <PageHeader
          title={t("loyalty.title")}
          subtitle={t("loyalty.subtitle")}
          badge={t("loyalty.badge")}
          icon={Trophy}
          actions={
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
              <span className="text-xs font-black text-main">{t("loyalty.systemStatus")}</span>
              <Switch checked={settings.enabled} onCheckedChange={setEnabled} />
              <Badge variant={settings.enabled ? "success" : "secondary"} className="rounded-xl px-3 py-1">
                {settings.enabled ? t("loyalty.active") : t("loyalty.inactive")}
              </Badge>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
          <div>
            <h3 className="text-sm font-black text-main flex items-center gap-2">
              <Trophy size={16} className="text-primary" /> {t("loyalty.title")}
            </h3>
            <p className="text-[11px] font-bold text-muted mt-1">{t("loyalty.systemStatusDesc")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <span className="text-xs font-black text-main hidden sm:inline">{t("loyalty.systemStatus")}</span>
            <Switch checked={settings.enabled} onCheckedChange={setEnabled} />
            <Badge variant={settings.enabled ? "success" : "secondary"} className="rounded-full text-[10px]"> {settings.enabled ? t("loyalty.active") : t("loyalty.inactive")} </Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <ContentPanel
          className="xl:col-span-8"
          title={t("loyalty.tiersTitle")}
          subtitle={t("loyalty.tiersSubtitle")}
          actions={
            <Badge variant="secondary" className="rounded-xl">
              {t("loyalty.tiersCount", { count: settings.tiers.length })}
            </Badge>
          }
        >
          <div className="space-y-3">
            {settings.tiers.map((tier, idx) => (
              <TierRow
                key={idx}
                tier={tier}
                index={idx}
                canRemove={idx > 0}
                onChange={updateTier}
                onRemove={removeTier}
              />
            ))}
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl border-dashed font-black hover:border-accent hover:bg-accent/5 hover:text-accent"
              onClick={addTier}
            >
              <Plus size={16} /> {t("loyalty.addTier")}
            </Button>
          </div>
        </ContentPanel>

        <div className="space-y-6 xl:col-span-4">
          <ContentPanel title={t("loyalty.rulesTitle")} subtitle={t("loyalty.rulesSubtitle")}>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelCls}>{t("loyalty.earnRate")}</label>
                <Input
                  type="number"
                  step="0.01"
                  min={LOYALTY_LIMITS.pointsPerEgpMin}
                  max={LOYALTY_LIMITS.pointsPerEgpMax}
                  value={settings.points_per_egp}
                  onChange={(e) => setRule("points_per_egp", Number(e.target.value))}
                  className="h-11 rounded-xl font-black tabular-nums"
                />
                <p className={hintCls}>{t("loyalty.earnRateHint")}</p>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>{t("loyalty.redeemValue")}</label>
                <Input
                  type="number"
                  step="0.1"
                  min={LOYALTY_LIMITS.redemptionMin}
                  max={LOYALTY_LIMITS.redemptionMax}
                  value={settings.redemption_rate}
                  onChange={(e) => setRule("redemption_rate", Number(e.target.value))}
                  className="h-11 rounded-xl font-black tabular-nums"
                />
                <p className={hintCls}>{t("loyalty.redeemValueHint")}</p>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>{t("loyalty.expiryMonths")}</label>
                <Input
                  type="number"
                  min={0}
                  max={LOYALTY_LIMITS.expiryMonthsMax}
                  value={settings.points_expiry_months}
                  onChange={(e) => setRule("points_expiry_months", Number(e.target.value))}
                  className="h-11 rounded-xl font-black tabular-nums"
                />
                <p className={hintCls}>{t("loyalty.expiryHint")}</p>
              </div>

              <Button className="h-12 w-full rounded-xl font-black" loading={saving} onClick={save}>
                <Save size={16} /> {t("loyalty.save")}
              </Button>
            </div>
          </ContentPanel>

          <PreviewCard settings={settings} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-dashed border-border/60 bg-soft/40 px-5 py-3 text-[11px] font-bold text-muted">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-success" /> {t("loyalty.autoCalcNote")}
        </span>
        <span className="flex items-center gap-1.5">
          <Gift size={14} className="text-accent" /> {t("loyalty.vipNote")}
        </span>
        <span className="flex items-center gap-1.5">
          <Activity size={14} className="text-info" /> {t("loyalty.discountsNote")}
        </span>
      </div>
    </div>
  );
}
