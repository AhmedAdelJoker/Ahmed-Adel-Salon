import { Calendar, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/core/utils";
import { PRESETS } from "@/features/financial-reports/constants";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import type { PresetId } from "@/features/financial-reports/constants";
import type { FinancialsState } from "@/types/reports";

export interface FilterBarProps {
  fromDate: string;
  toDate: string;
  preset: PresetId;
  lastUpdated: Date;
  prevRange: FinancialsState["prevRange"];
  refreshing: boolean;
  autoRefresh: boolean;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setAutoRefresh: (v: boolean) => void;
  applyPreset: (id: PresetId) => void;
  fetchFinancials: () => void;
  onPrint: () => void;
}

export function FilterBar({
  fromDate,
  toDate,
  preset,
  lastUpdated,
  prevRange,
  refreshing,
  autoRefresh,
  setFromDate,
  setToDate,
  setAutoRefresh,
  applyPreset,
  fetchFinancials,
  onPrint,
}: FilterBarProps) {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  return (
    <div className="sticky top-0 z-20 rounded-[1.5rem] border border-border/60 bg-card/85 p-3 shadow-soft backdrop-blur-md print:hidden">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("finFeat.filter.quickRanges")}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              aria-pressed={preset === p.id}
              className={cn(
                "h-9 rounded-xl border px-4 text-[11px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                preset === p.id
                  ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                  : "border-border bg-card text-muted hover:border-primary/40 hover:text-main",
              )}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm xl:flex-none">
            <label className="flex items-center gap-2 px-2">
              <Calendar size={14} className="shrink-0 text-muted" />
              <span className="sr-only">{t("finFeat.filter.from")}</span>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                }}
                aria-label={t("finFeat.filter.from")}
                className="h-8 w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
              />
            </label>
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <label className="flex items-center gap-2 px-2">
              <Calendar size={14} className="shrink-0 text-muted" />
              <span className="sr-only">{t("finFeat.filter.to")}</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                }}
                aria-label={t("finFeat.filter.to")}
                className="h-8 w-32 bg-transparent text-[11px] font-black tabular-nums text-main outline-none"
              />
            </label>
          </div>
          <Button onClick={fetchFinancials} loading={refreshing} className="h-10 gap-2 px-5 text-xs font-black">
            <RefreshCw size={15} /> {t("finFeat.filter.refresh")}
          </Button>
          <Button
            onClick={onPrint}
            variant="outline"
            className="h-10 gap-2 px-4 text-xs font-black"
            title={t("finFeat.filter.printTitle")}
          >
            <Printer size={15} /> {t("finFeat.filter.print")}
          </Button>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[11px] font-black text-muted">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label={t("finFeat.filter.autoSwitch")} />
            {t("finFeat.filter.auto")}
          </label>
        </div>
      </div>
      <p className="mt-2 px-1 text-[10px] font-bold tabular-nums text-muted">
        {t("finFeat.filter.lastAudit", { time: lastUpdated.toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }), from: fromDate, to: toDate })}
        {prevRange && (
          <>
            {t("finFeat.filter.prevCompare", { from: prevRange.from, to: prevRange.to })}
          </>
        )}
      </p>
    </div>
  );
}
