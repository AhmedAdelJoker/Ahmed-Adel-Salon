import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Copy,
  Moon,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Timer,
  Wand2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { businessSettingsService } from "@/services/businessSettingsService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PremiumCard, ContentPanel, SkeletonCard } from "@/components/shared/PremiumUI";
import { StatCard } from "@/components/shared/DisplayComponents";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import {
  errorHeadline,
  isConflict,
  toErrorLines,
  type ApiErrorLine,
} from "@/lib/core/apiErrors";
import {
  PRESETS,
  WORKING_HOURS_DAYS,
  buildTimeline,
  buildWorkingHours,
  cloneWorkingHours,
  crossesMidnight,
  dayKeyFor,
  emptyDay,
  findTimelineGaps,
  formatRange,
  makeDay,
  normalizeWorkingHours,
  sameWorkingHours,
  summarizeWorkingHours,
  timelineCoverage,
  validateDay,
  weekBarPercent,
  windowMinutes,
  type DayKey,
  type WorkingHoursMap,
} from "@/lib/domain/workingHours";

type WorkingHoursPanelProps = {
  onDirtyChange?: (dirty: boolean) => void;
  onVersionChange?: (version: number | undefined) => void;
};

type PendingAction =
  | { kind: "copy-all"; source: DayKey }
  | { kind: "preset"; presetId: string }
  | { kind: "discard" };

const WorkingHoursPanel = ({ onDirtyChange, onVersionChange }: WorkingHoursPanelProps) => {
  const { t, i18n } = useTranslation("owner");

  const dayName = (d: DayKey): string => t(`workingHours.day.${d}`);
  const dayShort = (d: DayKey): string => t(`workingHours.dayShort.${d}`);
  const fmtDur = (minutes: number): string => {
    if (minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return t("workingHours.durHour", { h });
    if (h === 0) return t("workingHours.durMin", { m });
    return t("workingHours.durHM", { h, m });
  };
  const errLabel = (raw: string | null): string => {
    if (!raw) return "";
    if (raw === "حدد وقت الفتح والإغلاق") return t("workingHours.errMissing");
    if (raw === "صيغة الوقت غير صحيحة") return t("workingHours.errFormat");
    if (raw === "وقت الإغلاق لا يمكن أن يساوي وقت الفتح") return t("workingHours.errSame");
    if (raw.startsWith("مدة الدوام قصيرة جداً")) return t("workingHours.errShort");
    return raw;
  };
  const presetLabel = (id: string): string => t(`workingHours.preset.${id}_label`);
  const presetDesc = (id: string): string => t(`workingHours.preset.${id}_desc`);

  const emptyHours = useMemo(() => normalizeWorkingHours(), []);
  const [hours, setHours] = useState<WorkingHoursMap>(() => cloneWorkingHours(emptyHours));
  const [initialHours, setInitialHours] = useState<WorkingHoursMap>(() =>
    cloneWorkingHours(emptyHours),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applySource, setApplySource] = useState<DayKey>("saturday");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saveErrors, setSaveErrors] = useState<ApiErrorLine[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);
  const [settingsVersion, setSettingsVersion] = useState<number | undefined>(undefined);

  const handleVersion = useCallback((version: number | undefined) => {
    setSettingsVersion(version);
    onVersionChange?.(version);
  }, [onVersionChange]);

  const todayKey = useMemo(() => dayKeyFor(), []);

  const fetchHours = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setSaveErrors([]);
      setConflict(null);
      const settings = await businessSettingsService.get();
      const normalized = normalizeWorkingHours(
        (settings?.working_hours || settings?.workingHours || {}) as Record<string, unknown>,
      );
      setHours(normalized);
      setInitialHours(cloneWorkingHours(normalized));
      handleVersion(Number((settings as Record<string, unknown> | undefined)?.version ?? 0) || undefined);
    } catch {
      setLoadError(t("workingHours.loadError"));
      toast.error(t("workingHours.loadToast"));
    } finally {
      setLoading(false);
    }
  }, [handleVersion]);

  useEffect(() => {
    void fetchHours();
  }, [fetchHours]);

  const isDirty = useMemo(() => !sameWorkingHours(hours, initialHours), [hours, initialHours]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const stats = useMemo(() => summarizeWorkingHours(hours), [hours]);
  const todayStatus = useMemo(() => {
    const cfg = hours[todayKey];
    if (!cfg?.is_open) return { title: t("workingHours.closed"), hint: t("workingHours.todayClosedHint"), open: false };
    const range = formatRange(cfg);
    const duration = fmtDur(windowMinutes(cfg));
    return { title: range ?? t("workingHours.open"), hint: `${duration}${crossesMidnight(cfg) ? ` • ${t("workingHours.endsNextDay")}` : ""}`, open: true };
  }, [hours, todayKey, t]);

  const errors = useMemo(() => {
    const map = {} as Record<DayKey, string | null>;
    WORKING_HOURS_DAYS.forEach((day) => {
      map[day] = validateDay(hours[day] || emptyDay());
    });
    return map;
  }, [hours]);

  const hasErrors = useMemo(() => WORKING_HOURS_DAYS.some((d) => Boolean(errors[d])), [errors]);

  const handleToggle = (day: DayKey) => {
    setHours((prev) => {
      const cur = prev[day] || emptyDay();
      return { ...prev, [day]: makeDay(!cur.is_open, cur.open_time, cur.close_time) };
    });
  };

  const handleChange = (day: DayKey, field: "open_time" | "close_time", value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] || emptyDay()), [field]: value || null },
    }));
  };

  const handleResetDay = (day: DayKey) => {
    setHours((prev) => ({ ...prev, [day]: { ...initialHours[day] } }));
    toast.success(t("workingHours.dayReset", { day: dayName(day) }));
  };

  const applyCopyToAll = (source: DayKey) => {
    const src = hours[source];
    if (!src) return;
    setHours(buildWorkingHours(() => ({ ...src })));
    toast.success(
      src.is_open
        ? t("workingHours.copyFrom", { day: dayName(source), range: formatRange(src) ?? "" })
        : t("workingHours.copyFromClosed", { day: dayName(source) }),
    );
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setHours(preset.build());
    toast.success(t("workingHours.presetApplied"));
  };

  const handleResetAll = () => {
    setHours(cloneWorkingHours(initialHours));
    toast.success(t("workingHours.resetAll"));
  };

  const handleSave = async () => {
    if (hasErrors) {
      const firstErrDay = WORKING_HOURS_DAYS.find((d) => errors[d]);
      if (firstErrDay) toast.error(`${dayName(firstErrDay)}: ${errLabel(errors[firstErrDay])}`);
      return;
    }
    setSaving(true);
    setSaveErrors([]);
    setConflict(null);
    try {
      const payload: Record<string, unknown> = { working_hours: hours };
      if (settingsVersion) payload.expectedVersion = settingsVersion;
      const saved = await businessSettingsService.update(payload);
      const raw = (saved ?? {}) as Record<string, unknown>;
      const persisted = saved
        ? normalizeWorkingHours(
            ((raw.working_hours ?? raw.workingHours ?? {}) as Record<string, unknown>),
          )
        : hours;
      setHours(persisted);
      setInitialHours(cloneWorkingHours(persisted));
      const nextVersion = Number(raw.version ?? 0) || undefined;
      if (nextVersion) handleVersion(nextVersion);
      toast.success(t("workingHours.saved"));
    } catch (err: unknown) {
      if (isConflict(err)) {
        const [line] = toErrorLines(err, t("workingHours.conflictFallback"));
        setConflict(line?.message ?? t("workingHours.conflictFallback"));
        toast.error(t("workingHours.conflictToast"));
        return;
      }
      const lines = toErrorLines(err, t("workingHours.saveFailedFallback"));
      setSaveErrors(lines);
      toast.error(errorHeadline(lines, t("workingHours.saveFailedFallback")));
    } finally {
      setSaving(false);
    }
  };

  const runPending = () => {
    if (!pending) return;
    if (pending.kind === "copy-all") applyCopyToAll(pending.source);
    else if (pending.kind === "preset") applyPreset(pending.presetId);
    else handleResetAll();
    setPending(null);
  };

  const confirmCopyAll = (source: DayKey) => {
    if (sameWorkingHours(hours, buildWorkingHours(() => ({ ...hours[source] })))) return;
    setPending({ kind: "copy-all", source });
  };

  const confirmPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset && sameWorkingHours(hours, preset.build())) {
      toast(t("workingHours.presetSameToast"), { icon: "ℹ️" });
      return;
    }
    setPending({ kind: "preset", presetId });
  };

  const confirmDiscardAll = () => {
    if (!isDirty) return;
    setPending({ kind: "discard" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" height={320} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-black text-main">{t("workingHours.loadTitle")}</p>
          <p className="text-xs font-bold text-muted max-w-md">{loadError}</p>
          <Button onClick={fetchHours} className="h-11 rounded-xl px-6 text-xs font-black">
            <RotateCcw size={14} className="ms-2" /> {t("workingHours.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const overnightCount = stats.overnightDays.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("workingHours.openDays")}
          value={`${stats.openDays} / 7`}
          icon={Sun}
          variant="success"
          hint={t("workingHours.perWeek", { hours: stats.totalHours })}
        />
        <StatCard
          label={t("workingHours.closedDays")}
          value={`${stats.closedDays}`}
          icon={Moon}
          variant="secondary"
          hint={stats.closedDays === 0 ? t("workingHours.allWeek") : t("workingHours.restDays")}
        />
        <StatCard
          label={t("workingHours.totalHours")}
          value={`${stats.totalHours} ${t("workingHours.hoursUnit")}`}
          icon={Timer}
          variant="primary"
          hint={stats.totalHours >= 60 ? t("workingHours.intensiveWeek") : stats.totalHours >= 40 ? t("workingHours.balancedWeek") : t("workingHours.lightWeek")}
        />
        <StatCard
          label={`${t("workingHours.todayLabel")} • ${dayName(todayKey)}`}
          value={todayStatus.title}
          icon={CalendarRange}
          variant={todayStatus.open ? "success" : "warning"}
          hint={todayStatus.hint}
        />
      </div>

      {overnightCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-[11px] font-black text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
          <Moon size={16} className="mt-0.5 shrink-0" />
          <span>
            {overnightCount === 1 ? t("workingHours.oneDay") : t("workingHours.daysOvernight", { count: overnightCount })} {t("workingHours.overnightNote", { days: stats.overnightDays.map((d) => dayName(d)).join((i18n.resolvedLanguage || i18n.language || "ar").startsWith("en") ? ", " : "\u060C ") })}
          </span>
        </div>
      )}

      <ContentPanel
        title={t("workingHours.panelTitle")}
        subtitle={t("workingHours.panelSubtitle")}
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="warning" className="rounded-full px-3 py-1 text-[10px] font-black">
                {t("workingHours.unsavedBadge")}
              </Badge>
            )}
        {conflict && (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
          >
            <div className="flex items-center gap-2 text-[11px] font-black text-amber-800 dark:text-amber-200">
              <AlertTriangle size={16} className="shrink-0" />
              {conflict}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHours}
                className="h-8 rounded-xl border-amber-300 px-3 text-[11px] font-black text-amber-800 dark:border-amber-700 dark:text-amber-200"
              >
                <RotateCcw size={13} className="ms-1" /> {t("workingHours.fetchLatest")}
              </Button>
              <span className="text-[10px] font-bold text-amber-700/80 dark:text-amber-300/80">
                {t("workingHours.conflictNote")}</span>
            </div>
          </div>
        )}

        {saveErrors.length > 0 && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/30"
          >
            <div className="flex items-center gap-2 text-[11px] font-black text-rose-700 dark:text-rose-300">
              <AlertTriangle size={16} className="shrink-0" />
              {saveErrors.length === 1
                ? t("workingHours.saveFailedOne")
                : t("workingHours.saveFailedMany", { count: saveErrors.length })}
            </div>
            <ul className="mt-2 space-y-1 pe-4">
              {saveErrors.map((line, index) => (
                <li
                  key={`${line.field ?? "err"}-${index}`}
                  className="text-[11px] font-bold text-rose-700/90 dark:text-rose-300/90"
                >
                  {line.field ? <span className="font-black">{line.field}: </span> : null}
                  {line.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasErrors && (
              <Badge variant="danger" className="rounded-full px-3 py-1 text-[10px] font-black">
                {t("workingHours.reviewErrors")}
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={confirmDiscardAll}
              disabled={!isDirty || saving}
              className="h-9 rounded-xl px-4 text-xs font-black hidden sm:inline-flex"
            >
              <RotateCcw size={14} className="ms-1" /> {t("workingHours.revert")}
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!isDirty || hasErrors}
              className="h-9 rounded-xl px-5 text-xs font-black"
            >
              <Save size={14} className="ms-1" /> {t("workingHours.saveHours")}
            </Button>
          </div>
        }
      >
        {hasErrors && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-black text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <AlertTriangle size={16} className="shrink-0" />
            {t("workingHours.dayErrorBanner")}
          </div>
        )}

        <PremiumCard
          noPadding
          hoverable={false}
          animate={false}
          className="overflow-hidden border-border/60 mb-6"
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                <Sparkles size={14} className="text-primary" /> {t("workingHours.weekPreview")}
              </h4>
              <span className="text-[10px] font-bold text-muted hidden sm:inline">
                {t("workingHours.weekPreviewHint")}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {WORKING_HOURS_DAYS.map((day) => {
                const cfg = hours[day];
                const isToday = day === todayKey;
                const overnight = crossesMidnight(cfg);
                const pct = weekBarPercent(cfg);
                const err = errors[day];
                const range = formatRange(cfg);
                return (
                  <div
                    key={day}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-2xl border p-2 sm:p-3 transition-all",
                      isToday ? "border-primary/30 bg-primary/5 shadow-sm" : "border-border bg-card",
                      !cfg.is_open && "bg-soft/40",
                      err && "border-rose-200 bg-rose-50/60",
                    )}
                  >
                    {isToday && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[8px] font-black text-white shadow">
                        {t("workingHours.todayLabel")}
                      </span>
                    )}
                    <div className="text-[10px] font-black text-main mt-1">{dayName(day)}</div>
                    <div className="w-full flex-1 flex items-end justify-center" style={{ minHeight: 56 }}>
                      <div
                        className={cn(
                          "relative w-full rounded-xl flex items-center justify-center text-[9px] font-black transition-all",
                          cfg.is_open
                            ? overnight
                              ? "bg-indigo-500 text-white shadow-sm"
                              : "bg-primary text-white shadow-sm"
                            : "bg-border text-muted border border-dashed",
                          err && cfg.is_open && "bg-rose-500",
                        )}
                        style={{ height: `${pct}%`, minHeight: cfg.is_open ? 28 : 22 }}
                        title={cfg.is_open ? range ?? "" : t("workingHours.closed")}
                      >
                        {cfg.is_open ? (
                          <span className="hidden sm:inline tabular-nums">
                            {overnight ? `${cfg.open_time}–${cfg.close_time} +1` : `${cfg.open_time}–${cfg.close_time}`}
                          </span>
                        ) : (
                          t("workingHours.closed")
                        )}
                        {overnight && (
                          <Moon
                            size={9}
                            className="absolute -top-1 -left-1 rounded-full bg-white/25 p-0.5"
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-[9px] font-bold tabular-nums text-muted h-3">
                      {cfg.is_open ? fmtDur(windowMinutes(cfg)) || "—" : "—"}
                    </div>
                    {err && (
                      <div className="text-[8px] font-black text-rose-600 text-center leading-tight">
                        {errLabel(err)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        <WeekTimeline hours={hours} />

        <PremiumCard
          noPadding
          hoverable={false}
          animate={false}
          className="overflow-hidden border-border/60 mb-6"
        >
          <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-1.5">
                <Wand2 size={12} className="text-primary" /> {t("workingHours.quickTemplates")}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => confirmPreset(preset.id)}
                    className="group flex flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5 text-right transition-all hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className="text-[11px] font-black text-main group-hover:text-primary transition-colors">
                      {presetLabel(preset.id)}
                    </span>
                    <span className="text-[9px] font-bold text-muted leading-snug">
                      {presetDesc(preset.id)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="flex items-center gap-2 flex-1 lg:flex-none bg-soft rounded-xl border border-border p-1">
                  <label
                    htmlFor="working-hours-copy-source"
                    className="text-[10px] font-black text-muted px-2 whitespace-nowrap"
                  >
                    {t("workingHours.copyFromLabel")}
                  </label>
                  <Select value={applySource} onValueChange={(v) => setApplySource(v as DayKey)}>
                    <SelectTrigger
                      id="working-hours-copy-source"
                      className="h-8 flex-1 min-w-[160px] rounded-lg bg-card border-border text-[11px] font-black"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKING_HOURS_DAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {dayName(d)} {hours[d]?.is_open ? `(${hours[d].open_time}-${hours[d].close_time})` : `(${t("workingHours.closed")})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => confirmCopyAll(applySource)}
                    className="h-8 rounded-lg text-[11px] font-black gap-1 shrink-0"
                  >
                    <Copy size={13} /> {t("workingHours.applyAll")}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] font-bold text-muted leading-relaxed lg:text-left">
                {t("workingHours.templatesNote")}
              </p>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard noPadding hoverable={false} animate={false} className="overflow-hidden p-0 mb-6">
          <div className="divide-y divide-border">
            {WORKING_HOURS_DAYS.map((day) => {
              const cfg = hours[day] || emptyDay();
              const err = errors[day];
              const isToday = day === todayKey;
              const dur = cfg.is_open ? fmtDur(windowMinutes(cfg)) : null;
              const overnight = crossesMidnight(cfg);
              const range = formatRange(cfg);
              return (
                <div
                  key={day}
                  className={cn(
                    "p-4 sm:p-5 flex flex-col gap-4 transition-colors",
                    cfg.is_open ? "bg-card" : "bg-soft/20",
                    isToday && "ring-1 ring-primary/15 ring-inset",
                    err && "bg-rose-50/40",
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border shadow-sm transition-colors",
                          cfg.is_open
                            ? "bg-primary text-white border-primary"
                            : "bg-soft text-muted border-border",
                          isToday && cfg.is_open && "ring-2 ring-primary/20",
                        )}
                      >
                        {dayName(day).charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-main">{dayName(day)}</span>
                          {isToday && (
                            <Badge variant="primary" className="h-5 text-[9px] px-2">
                              {t("workingHours.todayLabel")}
                            </Badge>
                          )}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 h-5 rounded-full border px-2 text-[9px] font-black",
                              cfg.is_open
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-soft text-muted border-border",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                cfg.is_open ? "bg-emerald-500" : "bg-muted",
                              )}
                            />
                            {cfg.is_open ? t("workingHours.open") : t("workingHours.closed")}
                          </span>
                          {dur && (
                            <span className="inline-flex h-5 items-center rounded-full bg-primary/10 border border-primary/15 px-2 text-[9px] font-black text-primary tabular-nums">
                              {dur}
                            </span>
                          )}
                          {overnight && (
                            <span className="inline-flex items-center gap-1 h-5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 text-[9px] font-black">
                              <Moon size={9} /> {t("workingHours.afterMidnight")}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-muted mt-1 tabular-nums">
                          {cfg.is_open
                            ? `${range} — ${dur}`
                            : t("workingHours.weeklyOff")}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {cfg.is_open ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-2 sm:gap-3 bg-soft/50 rounded-2xl border border-border p-2 sm:p-3"
                        >
                          <div className="flex-1 sm:flex-none space-y-1">
                            <label
                              htmlFor={`open-${day}`}
                              className="text-[9px] font-black text-muted uppercase tracking-widest me-1 block"
                            >
                              {t("workingHours.openLabel")}
                            </label>
                            <Input
                              id={`open-${day}`}
                              type="time"
                              step={300}
                              value={cfg.open_time ?? ""}
                              onChange={(e) => handleChange(day, "open_time", e.target.value)}
                              aria-invalid={Boolean(err)}
                              aria-describedby={err ? `err-${day}` : undefined}
                              className={cn(
                                "h-10 rounded-xl bg-card border-border font-black text-xs w-full sm:w-32 tabular-nums",
                                err && "border-rose-300 focus-visible:ring-rose-200",
                              )}
                            />
                          </div>
                          <div className="text-muted font-black text-xs mt-5 hidden sm:block">—</div>
                          <div className="flex-1 sm:flex-none space-y-1">
                            <label
                              htmlFor={`close-${day}`}
                              className="text-[9px] font-black text-muted uppercase tracking-widest me-1 flex items-center gap-1"
                            >
                              {t("workingHours.closeLabel")}
                              {overnight && (
                                <span className="text-indigo-500 font-black">{t("workingHours.nextDay")}</span>
                              )}
                            </label>
                            <Input
                              id={`close-${day}`}
                              type="time"
                              step={300}
                              value={cfg.close_time ?? ""}
                              onChange={(e) => handleChange(day, "close_time", e.target.value)}
                              aria-invalid={Boolean(err)}
                              aria-describedby={err ? `err-${day}` : undefined}
                              className={cn(
                                "h-10 rounded-xl bg-card border-border font-black text-xs w-full sm:w-32 tabular-nums",
                                err && "border-rose-300 focus-visible:ring-rose-200",
                              )}
                            />
                          </div>
                        </motion.div>
                      ) : (
                        <div className="hidden sm:flex h-10 items-center rounded-xl bg-soft border border-dashed border-border px-4 text-[11px] font-black text-muted">
                          {t("workingHours.closedNoSlots")}
                        </div>
                      )}

                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:pe-4 sm:border-r border-border bg-card sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 p-2 sm:p-0">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmCopyAll(day)}
                            title={t("workingHours.copyAllTitle", { day: dayName(day) })}
                            aria-label={t("workingHours.copyAllAria", { day: dayName(day) })}
                            className="h-8 w-8 p-0 rounded-xl border border-border bg-card hover:bg-soft"
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetDay(day)}
                            title={t("workingHours.resetDayTitle")}
                            aria-label={t("workingHours.resetDayAria", { day: dayName(day) })}
                            className="h-8 w-8 p-0 rounded-xl border border-border bg-card hover:bg-soft"
                          >
                            <RotateCcw size={14} />
                          </Button>
                        </div>
                        <div className="h-6 w-px bg-border hidden sm:block" />
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[11px] font-black", cfg.is_open ? "text-primary" : "text-muted")}>
                            {cfg.is_open ? t("workingHours.open") : t("workingHours.closed")}
                          </span>
                          <Switch
                            checked={cfg.is_open}
                            onCheckedChange={() => handleToggle(day)}
                            className="data-[state=checked]:bg-primary"
                            aria-label={t("workingHours.toggleAria", { day: dayName(day) })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {err && (
                    <div
                      id={`err-${day}`}
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700"
                    >
                      <AlertTriangle size={14} className="shrink-0" />
                      {errLabel(err)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PremiumCard>

        <div
          className={cn(
            "rounded-2xl border p-4 flex gap-3 transition-colors",
            isDirty
              ? "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
              : "border-border bg-soft/30 text-muted",
          )}
        >
          <div
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
              isDirty ? "bg-amber-500 text-white border-amber-500" : "bg-card text-muted border-border",
            )}
          >
            {isDirty ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black leading-none">
              {isDirty ? t("workingHours.dirtyTitle") : t("workingHours.syncedTitle")}
            </div>
            <p className="text-[11px] font-bold leading-relaxed mt-1 opacity-80">
              {isDirty ? t("workingHours.dirtyDesc") : t("workingHours.syncedDesc")}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] font-bold text-muted">
          {t("workingHours.tip")}
        </p>
      </ContentPanel>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === "copy-all"
            ? t("workingHours.confirmCopyTitle")
            : pending?.kind === "preset"
              ? t("workingHours.confirmPresetTitle")
              : t("workingHours.confirmDiscardTitle")
        }
        description={
          pending?.kind === "copy-all" && pending
            ? t("workingHours.confirmCopyDesc", { day: dayName(pending.source) })
            : pending?.kind === "preset" && pending
              ? t("workingHours.confirmPresetDesc", { desc: presetDesc(pending.presetId) })
              : t("workingHours.confirmDiscardDesc")
        }
        confirmText={pending?.kind === "discard" ? t("workingHours.revert") : t("workingHours.apply")}
        variant={pending?.kind === "discard" ? "danger" : "primary"}
        onConfirm={runPending}
      />
      <span className="sr-only" aria-live="polite">
        {isDirty ? t("workingHours.srDirty") : t("workingHours.srSaved")}
      </span>
    </div>
  );
};

type WeekTimelineProps = { hours: WorkingHoursMap };

const WeekTimeline = ({ hours }: WeekTimelineProps) => {
  const { t } = useTranslation("owner");
  const dayName = (d: DayKey): string => t(`workingHours.day.${d}`);
  const dayShort = (d: DayKey): string => t(`workingHours.dayShort.${d}`);
  const fmtDur = (minutes: number): string => {
    if (minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return t("workingHours.durHour", { h });
    if (h === 0) return t("workingHours.durMin", { m });
    return t("workingHours.durHM", { h, m });
  };
  const blocks = useMemo(() => buildTimeline(hours), [hours]);
  const gaps = useMemo(() => findTimelineGaps(hours), [hours]);
  const coverage = useMemo(() => timelineCoverage(hours), [hours]);
  const todayKey = useMemo(() => dayKeyFor(), []);
  const todayIndex = WORKING_HOURS_DAYS.indexOf(todayKey);
  const nowPosition = useMemo(() => {
    const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
    return ((todayIndex * 24 * 60 + minuteOfDay) / (7 * 24 * 60)) * 100;
  }, [todayIndex]);

  return (
    <PremiumCard
      noPadding
      hoverable={false}
      animate={false}
      className="overflow-hidden border-border/60 mb-6"
    >
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
            <CalendarRange size={14} className="text-primary" /> {t("workingHours.weekTimeline")}
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[9px] font-black tabular-nums">
              {t("workingHours.coverage", { pct: coverage })}
            </Badge>
            {gaps.slice(0, 2).map((gap) => (
              <Badge
                key={gap.label}
                variant="warning"
                className="rounded-full px-2.5 py-1 text-[9px] font-black"
              >
                {gap.hours >= 24 ? t("workingHours.gapDays", { days: Math.round((gap.hours / 24) * 10) / 10 }) : t("workingHours.gapHours", { hours: gap.hours })}
              </Badge>
            ))}
          </div>
        </div>

        <div className="relative">
          <div
            className="relative h-11 w-full overflow-hidden rounded-xl border border-border bg-soft/40"
            role="img"
            aria-label={t("workingHours.coverageAria", { pct: coverage })}
          >
            {blocks.map((block) => (
              <div
                key={`${block.day}-${block.start}`}
                className={cn(
                  "absolute top-0 flex h-full items-center justify-center overflow-hidden border-x border-white/40 text-[8px] font-black transition-all",
                  block.kind === "open"
                    ? block.overnight
                      ? "bg-indigo-500/90 text-white"
                      : "bg-primary/90 text-white"
                    : "bg-border/50",
                )}
                style={{
                  left: `${block.start}%`,
                  width: `${block.width}%`,
                }}
                title={
                  block.kind === "open"
                    ? `${dayName(block.day)} — ${fmtDur(windowMinutes(hours[block.day]))}${block.overnight ? ` • ${t("workingHours.endsNext")}` : ""}`
                    : t("workingHours.closedBlock", { label: dayName(block.day) })
                }
              >
                {block.width > 7 ? (
                  <span className="truncate px-1">
                    {block.overnight ? "🌙 " : ""}
                    {fmtDur(windowMinutes(hours[block.day]))}
                  </span>
                ) : null}
              </div>
            ))}

            {nowPosition >= 0 && nowPosition <= 100 && (
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-rose-500"
                style={{ left: `${nowPosition}%` }}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="mt-1.5 grid grid-cols-7 text-center text-[8px] font-black text-muted">
            {WORKING_HOURS_DAYS.map((day) => (
              <span key={day} className={cn(day === todayKey && "text-primary")}>
                {dayShort(day)}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[10px] font-bold text-muted leading-relaxed">
          {t("workingHours.timelineNote")}
        </p>
      </div>
    </PremiumCard>
  );
};

export default WorkingHoursPanel;
