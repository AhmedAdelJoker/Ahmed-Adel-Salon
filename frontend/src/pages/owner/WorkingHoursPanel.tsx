import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Copy,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Moon,
  Timer,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { businessSettingsService } from "@/services/businessSettingsService";
import type { DayConfig } from "@/types/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PremiumCard, ContentPanel, SkeletonCard } from "@/components/shared/PremiumUI";
import { StatCard } from "@/components/shared/DisplayComponents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";

const DAYS_AR: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

const ORDER = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

type DayKey = (typeof ORDER)[number];

const DEFAULT_DAY_CONFIG: DayConfig = {
  is_open: false,
  open_time: null,
  close_time: null,
};

const JS_DAY_TO_KEY: Record<number, DayKey> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

function parseMins(v: string | null): number | null {
  if (!v || typeof v !== "string") return null;
  const [h, m] = v.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minsToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function durationLabel(open: string | null, close: string | null): string | null {
  const o = parseMins(open);
  const c = parseMins(close);
  if (o === null || c === null) return null;
  const diff = c - o;
  if (diff <= 0) return null;
  const hours = diff / 60;
  if (Number.isInteger(hours)) return `${hours} ساعة`;
  return `${hours.toFixed(1)} ساعة`;
}

function validateDay(c: DayConfig): string | null {
  if (!c.is_open) return null;
  if (!c.open_time || !c.close_time) return "حدد وقت الفتح والإغلاق";
  const o = parseMins(c.open_time);
  const cc = parseMins(c.close_time);
  if (o === null || cc === null) return "صيغة الوقت غير صحيحة";
  if (cc <= o) return "وقت الإغلاق يجب أن يكون بعد الفتح";
  if (cc - o < 30) return "مدة الدوام قصيرة جداً (أقل من 30 دقيقة)";
  return null;
}

const normalizeDayConfig = (config: Record<string, unknown> = {}): DayConfig => {
  const isOpen = Boolean((config as Record<string, unknown>)?.is_open);
  return {
    is_open: isOpen,
    open_time: isOpen ? (String((config as Record<string, unknown>)?.open_time || "10:00")) : null,
    close_time: isOpen ? (String((config as Record<string, unknown>)?.close_time || "22:00")) : null,
  };
};

const normalizeWorkingHours = (rawHours: Record<string, unknown> = {}): Record<DayKey, DayConfig> =>
  ORDER.reduce<Record<DayKey, DayConfig>>((acc, day) => {
    acc[day] = normalizeDayConfig((rawHours?.[day] as Record<string, unknown>) || DEFAULT_DAY_CONFIG);
    return acc;
  }, {} as Record<DayKey, DayConfig>);

type WorkingHoursPanelProps = {
  onDirtyChange?: (dirty: boolean) => void;
};

const WorkingHoursPanel = ({ onDirtyChange }: WorkingHoursPanelProps) => {
  const [hours, setHours] = useState<Record<DayKey, DayConfig>>(() => normalizeWorkingHours());
  const [initialHours, setInitialHours] = useState<Record<DayKey, DayConfig>>(() => normalizeWorkingHours());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applySource, setApplySource] = useState<DayKey>("saturday");
  const [loadError, setLoadError] = useState<string | null>(null);

  const todayKey: DayKey = useMemo(() => JS_DAY_TO_KEY[new Date().getDay()], []);

  const fetchHours = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const settings = await businessSettingsService.get();
      const normalized = normalizeWorkingHours(
        (settings?.working_hours || settings?.workingHours || {}) as Record<string, unknown>,
      );
      setHours(normalized);
      setInitialHours(normalized);
    } catch {
      setLoadError("تعذر تحميل ساعات العمل. تحقق من الاتصال ثم أعد المحاولة.");
      toast.error("فشل تحميل ساعات العمل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHours();
  }, []);

  const isDirty = useMemo(() => JSON.stringify(hours) !== JSON.stringify(initialHours), [hours, initialHours]);

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

  const stats = useMemo(() => {
    const openDays = ORDER.filter((d) => hours[d]?.is_open).length;
    const closedDays = 7 - openDays;
    let totalMins = 0;
    ORDER.forEach((d) => {
      const c = hours[d];
      if (!c?.is_open) return;
      const o = parseMins(c.open_time);
      const cc = parseMins(c.close_time);
      if (o !== null && cc !== null && cc > o) totalMins += cc - o;
    });
    const totalHours = Math.round((totalMins / 60) * 10) / 10;
    const todayCfg = hours[todayKey];
    const todayLabel = todayCfg?.is_open
      ? `مفتوح ${todayCfg.open_time} – ${todayCfg.close_time}`
      : "مغلق اليوم";
    return { openDays, closedDays, totalHours, todayLabel, totalMins };
  }, [hours, todayKey]);

  const errors = useMemo(() => {
    const map: Record<string, string | null> = {};
    ORDER.forEach((d) => {
      map[d] = validateDay(hours[d] || DEFAULT_DAY_CONFIG);
    });
    return map as Record<DayKey, string | null>;
  }, [hours]);

  const hasErrors = useMemo(() => ORDER.some((d) => Boolean(errors[d])), [errors]);

  const handleToggle = (day: DayKey) => {
    setHours((prev) => {
      const cur = normalizeDayConfig(prev[day] as unknown as Record<string, unknown>);
      const isOpen = !cur.is_open;
      return {
        ...prev,
        [day]: {
          is_open: isOpen,
          open_time: isOpen ? cur.open_time || "10:00" : null,
          close_time: isOpen ? cur.close_time || "22:00" : null,
        },
      };
    });
  };

  const handleChange = (day: DayKey, field: "open_time" | "close_time", value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || DEFAULT_DAY_CONFIG),
        [field]: value || null,
      },
    }));
  };

  const handleResetDay = (day: DayKey) => {
    setHours((prev) => ({ ...prev, [day]: { ...initialHours[day] } }));
    toast.success(`تمت إعادة ${DAYS_AR[day]} للحالة المحفوظة`);
  };

  const handleCopyDayToAll = (source: DayKey) => {
    const src = hours[source];
    if (!src) return;
    const next: Record<DayKey, DayConfig> = {} as Record<DayKey, DayConfig>;
    ORDER.forEach((d) => {
      next[d] = { ...src };
    });
    setHours(next);
    toast.success(`تم نسخ مواعيد ${DAYS_AR[source]} إلى كل الأيام`);
  };

  const applyPresetAllOpen = () => {
    const next: Record<DayKey, DayConfig> = {} as Record<DayKey, DayConfig>;
    ORDER.forEach((d) => {
      next[d] = { is_open: true, open_time: "10:00", close_time: "22:00" };
    });
    setHours(next);
    toast.success("تم تطبيق 10:00 – 22:00 على كل الأيام");
  };

  const applyPresetFridayClosed = () => {
    const next: Record<DayKey, DayConfig> = {} as Record<DayKey, DayConfig>;
    ORDER.forEach((d) => {
      if (d === "friday") next[d] = { is_open: false, open_time: null, close_time: null };
      else next[d] = { is_open: true, open_time: "10:00", close_time: "22:00" };
    });
    setHours(next);
    toast.success("تم تطبيق: الجمعة مغلق وباقي الأيام 10:00 – 22:00");
  };

  const applyPresetWeekendLight = () => {
    const next: Record<DayKey, DayConfig> = {} as Record<DayKey, DayConfig>;
    ORDER.forEach((d) => {
      if (d === "friday") next[d] = { is_open: false, open_time: null, close_time: null };
      else if (d === "saturday") next[d] = { is_open: true, open_time: "09:00", close_time: "18:00" };
      else next[d] = { is_open: true, open_time: "10:00", close_time: "22:00" };
    });
    setHours(next);
    toast.success("تم تطبيق نمط عطلة مخفف (السبت 09-18، الجمعة مغلق)");
  };

  const handleResetAll = () => {
    setHours({ ...initialHours });
    toast.success("تم التراجع عن التعديلات غير المحفوظة");
  };

  const handleSave = async () => {
    if (hasErrors) {
      const firstErrDay = ORDER.find((d) => errors[d]);
      if (firstErrDay) toast.error(`${DAYS_AR[firstErrDay]}: ${errors[firstErrDay]}`);
      return;
    }
    setSaving(true);
    try {
      await businessSettingsService.update({ working_hours: hours });
      setInitialHours({ ...hours });
      toast.success("تم حفظ ساعات العمل بنجاح");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
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
          <p className="text-sm font-black text-main">تعذر تحميل بروتوكول التشغيل</p>
          <p className="text-xs font-bold text-muted max-w-md">{loadError}</p>
          <Button onClick={fetchHours} className="h-11 rounded-xl px-6 text-xs font-black">
            <RotateCcw size={14} className="ml-2" /> إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="أيام مفتوحة"
          value={`${stats.openDays} / 7`}
          icon={Sun}
          variant="success"
          hint={`${stats.totalHours} ساعة تشغيل أسبوعياً`}
        />
        <StatCard
          label="أيام مغلقة"
          value={`${stats.closedDays}`}
          icon={Moon}
          variant="secondary"
          hint={stats.closedDays === 0 ? "يعمل طوال الأسبوع" : "أيام راحة مجدولة"}
        />
        <StatCard
          label="إجمالي الساعات"
          value={`${stats.totalHours} س`}
          icon={Timer}
          variant="primary"
          hint={stats.totalHours >= 60 ? "أسبوع تشغيلي مكثف" : stats.totalHours >= 40 ? "دوام متوازن" : "دوام مخفف"}
        />
        <StatCard
          label={`اليوم • ${DAYS_AR[todayKey]}`}
          value={hours[todayKey]?.is_open ? `${hours[todayKey].open_time} – ${hours[todayKey].close_time}` : "مغلق"}
          icon={CalendarRange}
          variant={hours[todayKey]?.is_open ? "success" : "warning"}
          hint={stats.todayLabel}
        />
      </div>

      <ContentPanel
        title="بروتوكول ساعات التشغيل"
        subtitle="تتحكم هذه المواعيد في الحجز العام، توفر المواعيد، وفتح الورديات. الجمعة مغلق افتراضياً."
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="warning" className="rounded-full px-3 py-1 text-[10px] font-black">
                غير محفوظ
              </Badge>
            )}
            {hasErrors && (
              <Badge variant="danger" className="rounded-full px-3 py-1 text-[10px] font-black">
                راجع الأخطاء
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={handleResetAll}
              disabled={!isDirty || saving}
              className="h-9 rounded-xl px-4 text-xs font-black hidden sm:inline-flex"
            >
              <RotateCcw size={14} className="ml-1" /> تراجع
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!isDirty || hasErrors}
              className="h-9 rounded-xl px-5 text-xs font-black"
            >
              <Save size={14} className="ml-1" /> حفظ المواعيد
            </Button>
          </div>
        }
      >
        {hasErrors && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-black text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertTriangle size={16} className="shrink-0" />
            يوجد خطأ في أحد الأيام — راجع الحقول المميزة باللون الأحمر قبل الحفظ.
          </div>
        )}

        {/* Visual week strip */}
        <PremiumCard noPadding hoverable={false} className="overflow-hidden border-border/60 mb-6" animate={false}>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
              <Sparkles size={14} className="text-primary" /> معاينة الأسبوع
            </h4>
            <span className="text-[10px] font-bold text-muted hidden sm:inline">
              العرض يتناسب مع مدة الدوام — الأعمدة الأطول تعني يوماً أطول
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {ORDER.map((day) => {
              const cfg = hours[day];
              const isToday = day === todayKey;
              const durMins = cfg.is_open ? (parseMins(cfg.close_time) ?? 0) - (parseMins(cfg.open_time) ?? 0) : 0;
              const pct = cfg.is_open ? Math.max(18, Math.min(100, (durMins / 720) * 100)) : 12;
              const err = errors[day];
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
                      اليوم
                    </span>
                  )}
                  <div className="text-[10px] font-black text-main mt-1">{DAYS_AR[day]}</div>
                  <div className="w-full flex-1 flex items-end justify-center" style={{ minHeight: 56 }}>
                    <div
                      className={cn(
                        "w-full rounded-xl flex items-center justify-center text-[9px] font-black transition-all",
                        cfg.is_open ? "bg-primary text-white shadow-sm" : "bg-border text-muted border border-dashed",
                        err && cfg.is_open && "bg-rose-500",
                      )}
                      style={{ height: `${pct}%`, minHeight: cfg.is_open ? 28 : 22 }}
                      title={cfg.is_open ? `${cfg.open_time} – ${cfg.close_time}` : "مغلق"}
                    >
                      {cfg.is_open ? (
                        <span className="hidden sm:inline tabular-nums">
                          {cfg.open_time}–{cfg.close_time}
                        </span>
                      ) : (
                        "مغلق"
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] font-bold tabular-nums text-muted h-3">
                    {cfg.is_open ? durationLabel(cfg.open_time, cfg.close_time) || "—" : "—"}
                  </div>
                  {err && <div className="text-[8px] font-black text-rose-600 text-center leading-tight">{err}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </PremiumCard>

      {/* Presets + apply-to-all */}
      <PremiumCard noPadding hoverable={false} animate={false} className="overflow-hidden border-border/60 mb-6">
        <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">قوالب سريعة:</span>
            <Button variant="outline" size="sm" onClick={applyPresetAllOpen} className="h-8 rounded-xl text-[11px] font-black">
              كل الأيام 10–22
            </Button>
            <Button variant="outline" size="sm" onClick={applyPresetFridayClosed} className="h-8 rounded-xl text-[11px] font-black">
              الجمعة مغلق
            </Button>
            <Button variant="outline" size="sm" onClick={applyPresetWeekendLight} className="h-8 rounded-xl text-[11px] font-black">
              عطلة مخففة
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 flex-1 lg:flex-none bg-soft rounded-xl border border-border p-1">
              <span className="text-[10px] font-black text-muted px-2 whitespace-nowrap">نسخ من</span>
              <Select value={applySource} onValueChange={(v) => setApplySource(v as DayKey)}>
                <SelectTrigger className="h-8 flex-1 min-w-[160px] rounded-lg bg-card border-border text-[11px] font-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DAYS_AR[d]} {hours[d]?.is_open ? `(${hours[d].open_time}-${hours[d].close_time})` : "(مغلق)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCopyDayToAll(applySource)}
                className="h-8 rounded-lg text-[11px] font-black gap-1 shrink-0"
              >
                <Copy size={13} /> تطبيق على الكل
              </Button>
            </div>
          </div>
        </div>
        <p className="text-[10px] font-bold text-muted leading-relaxed">
          القوالب تكتب فوق المواعيد الحالية فوراً — يمكنك التراجع قبل الحفظ. "تطبيق على الكل" ينسخ حالة يوم واحد (مفتوح/مغلق مع أوقاته) إلى باقي الأسبوع.
        </p>
        </div>
      </PremiumCard>

      {/* Days list */}
      <PremiumCard noPadding hoverable={false} animate={false} className="overflow-hidden p-0 mb-6">
        <div className="divide-y divide-border">
          {ORDER.map((day) => {
            const cfg = hours[day] || DEFAULT_DAY_CONFIG;
            const err = errors[day];
            const isToday = day === todayKey;
            const dur = cfg.is_open ? durationLabel(cfg.open_time, cfg.close_time) : null;
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
                {/* Mobile layout stacks, desktop is row */}
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
                      {DAYS_AR[day].charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-main">{DAYS_AR[day]}</span>
                        {isToday && <Badge variant="primary" className="h-5 text-[9px] px-2">اليوم</Badge>}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 h-5 rounded-full border px-2 text-[9px] font-black",
                            cfg.is_open
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-soft text-muted border-border",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.is_open ? "bg-emerald-500" : "bg-muted")} />
                          {cfg.is_open ? "مفتوح" : "مغلق"}
                        </span>
                        {dur && (
                          <span className="inline-flex h-5 items-center rounded-full bg-primary/10 border border-primary/15 px-2 text-[9px] font-black text-primary tabular-nums">
                            {dur}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-muted mt-1">
                        {cfg.is_open ? `${cfg.open_time} – ${cfg.close_time}` : "عطلة أسبوعية — لا يُستقبل حجز"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3">
                    {cfg.is_open ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 sm:gap-3 bg-soft/50 rounded-2xl border border-border p-2 sm:p-3"
                      >
                        <div className="flex-1 sm:flex-none space-y-1">
                          <label className="text-[9px] font-black text-muted uppercase tracking-widest mr-1">الفتح</label>
                          <Input
                            type="time"
                            value={cfg.open_time ?? ""}
                            onChange={(e) => handleChange(day, "open_time", e.target.value)}
                            className={cn(
                              "h-10 rounded-xl bg-card border-border font-black text-xs w-full sm:w-32 tabular-nums",
                              err && "border-rose-300 focus-visible:ring-rose-200",
                            )}
                          />
                        </div>
                        <div className="text-muted font-black text-xs mt-5 hidden sm:block">—</div>
                        <div className="flex-1 sm:flex-none space-y-1">
                          <label className="text-[9px] font-black text-muted uppercase tracking-widest mr-1">الإغلاق</label>
                          <Input
                            type="time"
                            value={cfg.close_time ?? ""}
                            onChange={(e) => handleChange(day, "close_time", e.target.value)}
                            className={cn(
                              "h-10 rounded-xl bg-card border-border font-black text-xs w-full sm:w-32 tabular-nums",
                              err && "border-rose-300 focus-visible:ring-rose-200",
                            )}
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <div className="hidden sm:flex h-10 items-center rounded-xl bg-soft border border-dashed border-border px-4 text-[11px] font-black text-muted">
                        مغلق — لن تظهر مواعيد لهذا اليوم
                      </div>
                    )}

                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2 sm:pr-4 sm:border-r border-border bg-card sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 p-2 sm:p-0">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyDayToAll(day)}
                          title={`نسخ ${DAYS_AR[day]} إلى كل الأيام`}
                          className="h-8 w-8 p-0 rounded-xl border border-border bg-card hover:bg-soft"
                        >
                          <Copy size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetDay(day)}
                          title="إعادة هذا اليوم للحالة المحفوظة"
                          className="h-8 w-8 p-0 rounded-xl border border-border bg-card hover:bg-soft"
                        >
                          <RotateCcw size={14} />
                        </Button>
                      </div>
                      <div className="h-6 w-px bg-border hidden sm:block" />
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[11px] font-black", cfg.is_open ? "text-primary" : "text-muted")}>
                          {cfg.is_open ? "مفتوح" : "مغلق"}
                        </span>
                        <Switch
                          checked={cfg.is_open}
                          onCheckedChange={() => handleToggle(day)}
                          className="data-[state=checked]:bg-primary"
                          aria-label={`تبديل ${DAYS_AR[day]}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {err && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700">
                    <AlertTriangle size={14} className="shrink-0" />
                    {err}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PremiumCard>

      {/* Impact */}
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
            {isDirty ? "تعديلات غير محفوظة — سيتأثر الحجز والورديات" : "المواعيد متزامنة مع الخادم"}
          </div>
          <p className="text-[11px] font-bold leading-relaxed mt-1 opacity-80">
            {isDirty
              ? "بعد الحفظ: سيُحدّث الموقع العام، وتُفلتر المواعيد المتاحة، ويُمنع فتح وردية خارج الساعات المحددة. لم يتم الحفظ بعد."
              : "أي تغيير هنا ينعكس فور حفظه على صفحة الحجز العامة وجدولة المواعيد ونظام الورديات."}
          </p>
        </div>
      </div>

      <p className="text-center text-[10px] font-bold text-muted">
        نصيحة: اجعل الجمعة مغلقاً لتطابق العطلة الرسمية، واستخدم القوالب لتطبيق نفس الدوام بسرعة.
      </p>
      </ContentPanel>
    </div>
  );
};

export default WorkingHoursPanel;
