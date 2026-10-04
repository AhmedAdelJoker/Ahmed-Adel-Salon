import type { DayConfig } from "@/types/attendance";

export const WORKING_HOURS_DAYS = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export type DayKey = (typeof WORKING_HOURS_DAYS)[number];

export type WorkingHoursMap = Record<DayKey, DayConfig>;

export const DAYS_AR: Record<DayKey, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

export const DAYS_SHORT_AR: Record<DayKey, string> = {
  saturday: "سبت",
  sunday: "أحد",
  monday: "اثن",
  tuesday: "ثلا",
  wednesday: "أرب",
  thursday: "خمي",
  friday: "جمع",
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

export const MIN_WINDOW_MINUTES = 30;
const MAX_REFERENCE_MINUTES = 16 * 60;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const dayKeyFor = (value: Date = new Date()): DayKey =>
  JS_DAY_TO_KEY[value.getDay()];

export const parseMins = (value: string | null | undefined): number | null => {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!HHMM_RE.test(raw)) return null;
  return Number(raw.slice(0, 2)) * 60 + Number(raw.slice(3, 5));
};

export const minsToLabel = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const crossesMidnight = (config: DayConfig | null | undefined): boolean => {
  if (!config?.is_open) return false;
  const open = parseMins(config.open_time);
  const close = parseMins(config.close_time);
  if (open === null || close === null) return false;
  return close <= open;
};

export const windowMinutes = (config: DayConfig | null | undefined): number => {
  if (!config?.is_open) return 0;
  const open = parseMins(config.open_time);
  const close = parseMins(config.close_time);
  if (open === null || close === null) return 0;
  const diff = close - open;
  return diff > 0 ? diff : diff + 24 * 60;
};

export const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} ساعة`;
  if (h === 0) return `${m} دقيقة`;
  return `${h} س ${m} د`;
};

export const formatRange = (config: DayConfig | null | undefined): string | null => {
  if (!config?.is_open) return null;
  const open = parseMins(config.open_time);
  const close = parseMins(config.close_time);
  if (open === null || close === null) return null;
  const suffix = crossesMidnight(config) ? " (+1)" : "";
  return `${minsToLabel(open)} – ${minsToLabel(close)}${suffix}`;
};

export const durationLabel = (
  open: string | null,
  close: string | null,
): string | null => {
  const o = parseMins(open);
  const c = parseMins(close);
  if (o === null || c === null) return null;
  const diff = c - o;
  if (diff === 0) return null;
  return formatDuration(diff > 0 ? diff : diff + 24 * 60);
};

export const validateDay = (config: DayConfig): string | null => {
  if (!config.is_open) return null;
  if (!config.open_time || !config.close_time) return "حدد وقت الفتح والإغلاق";
  const open = parseMins(config.open_time);
  const close = parseMins(config.close_time);
  if (open === null || close === null) return "صيغة الوقت غير صحيحة";
  if (open === close) return "وقت الإغلاق لا يمكن أن يساوي وقت الفتح";
  const minutes = close > open ? close - open : close + 24 * 60 - open;
  if (minutes < MIN_WINDOW_MINUTES) {
    return "مدة الدوام قصيرة جداً (أقل من 30 دقيقة)";
  }
  return null;
};

export const emptyDay = (): DayConfig => ({
  is_open: false,
  open_time: null,
  close_time: null,
});

const normalizeDay = (raw: unknown): DayConfig => {
  if (!raw || typeof raw !== "object") return emptyDay();
  const source = raw as Record<string, unknown>;
  const isOpen =
    source.is_open === true ||
    source.is_open === 1 ||
    source.is_open === "true" ||
    source.is_open === "1";
  if (!isOpen) return emptyDay();
  const open = typeof source.open_time === "string" ? source.open_time.trim() : "";
  const close = typeof source.close_time === "string" ? source.close_time.trim() : "";
  if (!HHMM_RE.test(open) || !HHMM_RE.test(close)) return emptyDay();
  return { is_open: true, open_time: open, close_time: close };
};

export const normalizeWorkingHours = (raw?: unknown): WorkingHoursMap => {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return WORKING_HOURS_DAYS.reduce((acc, day) => {
    acc[day] = normalizeDay(source[day]);
    return acc;
  }, {} as WorkingHoursMap);
};

export const cloneWorkingHours = (hours: WorkingHoursMap): WorkingHoursMap =>
  WORKING_HOURS_DAYS.reduce((acc, day) => {
    acc[day] = { ...hours[day] };
    return acc;
  }, {} as WorkingHoursMap);

export const sameWorkingHours = (a: WorkingHoursMap, b: WorkingHoursMap): boolean =>
  WORKING_HOURS_DAYS.every((day) => {
    const left = a[day];
    const right = b[day];
    if (!left || !right) return false;
    return (
      left.is_open === right.is_open &&
      (left.open_time ?? "") === (right.open_time ?? "") &&
      (left.close_time ?? "") === (right.close_time ?? "")
    );
  });

export const buildWorkingHours = (
  pick: (day: DayKey) => DayConfig,
): WorkingHoursMap =>
  WORKING_HOURS_DAYS.reduce((acc, day) => {
    acc[day] = { ...pick(day) };
    return acc;
  }, {} as WorkingHoursMap);

export const makeDay = (
  isOpen: boolean,
  openTime: string | null,
  closeTime: string | null,
): DayConfig => ({
  is_open: isOpen,
  open_time: isOpen ? openTime ?? "10:00" : null,
  close_time: isOpen ? closeTime ?? "22:00" : null,
});

export type WorkingHoursSummary = {
  openDays: number;
  closedDays: number;
  totalMinutes: number;
  totalHours: number;
  overnightDays: DayKey[];
  longestDay: DayKey | null;
};

export const summarizeWorkingHours = (
  hours: WorkingHoursMap,
): WorkingHoursSummary => {
  let totalMinutes = 0;
  let longestDay: DayKey | null = null;
  let longestMinutes = 0;
  const overnightDays: DayKey[] = [];

  WORKING_HOURS_DAYS.forEach((day) => {
    const config = hours[day];
    if (!config?.is_open) return;
    const minutes = windowMinutes(config);
    totalMinutes += minutes;
    if (minutes > longestMinutes) {
      longestMinutes = minutes;
      longestDay = day;
    }
    if (crossesMidnight(config)) overnightDays.push(day);
  });

  const openDays = WORKING_HOURS_DAYS.filter((d) => hours[d]?.is_open).length;

  return {
    openDays,
    closedDays: WORKING_HOURS_DAYS.length - openDays,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    overnightDays,
    longestDay,
  };
};

export const weekBarPercent = (config: DayConfig | null | undefined): number => {
  if (!config?.is_open) return 12;
  const minutes = windowMinutes(config);
  const pct = (minutes / MAX_REFERENCE_MINUTES) * 100;
  return Math.max(18, Math.min(100, Math.round(pct)));
};

export const todayStatusLabel = (
  config: DayConfig | null | undefined,
): { title: string; hint: string; open: boolean } => {
  if (!config?.is_open) {
    return { title: "مغلق", hint: "لا يُستقبل حجز اليوم", open: false };
  }
  const range = formatRange(config);
  const duration = formatDuration(windowMinutes(config));
  return {
    title: range ?? "مفتوح",
    hint: `${duration}${crossesMidnight(config) ? " • ينتهي بعد منتصف الليل" : ""}`,
    open: true,
  };
};

export type TimelineBlock = {
  day: DayKey;
  kind: "open" | "closed";
  /** Percentage offset into the week where the block starts. */
  start: number;
  /** Percentage width of the block. */
  width: number;
  label: string;
  detail: string;
  overnight: boolean;
};

export type TimelineGap = {
  /** Hours of continuous closure before this open block. */
  hours: number;
  label: string;
};

const HOURS_PER_DAY = 24;

/**
 * Projects the week onto a single 0–100% timeline.
 *
 * A bar chart of seven columns hides the only thing that matters when a day
 * closes before it opens: whether the salon is actually reachable. Consecutive
 * open days fuse into one block, and the dead air between blocks is reported so
 * a Friday closure reads as a 24h hole rather than an empty column.
 */
export const buildTimeline = (hours: WorkingHoursMap): TimelineBlock[] => {
  const blocks: TimelineBlock[] = [];

  WORKING_HOURS_DAYS.forEach((day, index) => {
    const config = hours[day];
    const dayStart = (index * 100) / 7;
    const dayWidth = 100 / 7;

    if (!config?.is_open) {
      blocks.push({
        day,
        kind: "closed",
        start: dayStart,
        width: dayWidth,
        label: DAYS_AR[day],
        detail: "مغلق",
        overnight: false,
      });
      return;
    }

    const open = parseMins(config.open_time) ?? 0;
    const close = parseMins(config.close_time) ?? 0;
    const overnight = crossesMidnight(config);
    const spanMinutes = overnight ? close + HOURS_PER_DAY * 60 - open : close - open;

    blocks.push({
      day,
      kind: "open",
      start: dayStart + (open / (HOURS_PER_DAY * 60)) * dayWidth,
      width: (spanMinutes / (HOURS_PER_DAY * 60)) * dayWidth,
      label: `${DAYS_AR[day]} ${config.open_time} – ${config.close_time}`,
      detail: overnight
        ? `${formatDuration(windowMinutes(config))} • ينتهي اليوم التالي`
        : formatDuration(windowMinutes(config)),
      overnight,
    });
  });

  return blocks;
};

/** Continuous closed stretches in the week, longest first. */
export const findTimelineGaps = (hours: WorkingHoursMap): TimelineGap[] => {
  const SLOTS = 7 * HOURS_PER_DAY; // one slot per hour across the week
  const open = new Array<boolean>(SLOTS).fill(false);

  WORKING_HOURS_DAYS.forEach((day, dayIndex) => {
    const config = hours[day];
    if (!config?.is_open) return;
    const from = parseMins(config.open_time);
    const to = parseMins(config.close_time);
    if (from === null || to === null) return;
    // a window keyed by its opening day may run into the next day
    const lastMinute = to <= from ? to + HOURS_PER_DAY * 60 : to;
    for (let minute = from; minute < lastMinute; minute += 1) {
      const absolute = dayIndex * HOURS_PER_DAY * 60 + minute;
      const slot = Math.floor(absolute / 60);
      if (slot >= 0 && slot < SLOTS) open[slot] = true;
    }
  });

  const gaps: TimelineGap[] = [];
  let run = 0;
  for (let i = 0; i <= SLOTS; i += 1) {
    if (i < SLOTS && !open[i]) {
      run += 1;
      continue;
    }
    if (run >= 1) {
      gaps.push({
        hours: run,
        label:
          run >= 24
            ? `${Math.round((run / 24) * 10) / 10} يوم مغلق`
            : `${run} ساعة مغلقة`,
      });
    }
    run = 0;
  }
  return gaps.sort((a, b) => b.hours - a.hours);
};

export const timelineCoverage = (hours: WorkingHoursMap): number => {
  const blocks = buildTimeline(hours);
  const openMinutes = blocks
    .filter((b) => b.kind === "open")
    .reduce((sum, b) => sum + (b.width / 100) * (7 * HOURS_PER_DAY), 0);
  return Math.round((openMinutes / (7 * HOURS_PER_DAY)) * 100);
};

export const PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  build: () => WorkingHoursMap;
}> = [
  {
    id: "all-days",
    label: "كل الأيام 10–22",
    description: "فتح أيام الأسبوع بالكامل من 10:00 حتى 22:00",
    build: () => buildWorkingHours(() => makeDay(true, "10:00", "22:00")),
  },
  {
    id: "friday-closed",
    label: "الجمعة مغلق",
    description: "الجمعة عطلة، وباقي الأسبوع 10:00 – 22:00",
    build: () =>
      buildWorkingHours((day) =>
        day === "friday" ? makeDay(false, null, null) : makeDay(true, "10:00", "22:00"),
      ),
  },
  {
    id: "weekend-light",
    label: "عطلة مخففة",
    description: "السبت 09:00 – 18:00، الجمعة مغلق، والباقي 10:00 – 22:00",
    build: () =>
      buildWorkingHours((day) => {
        if (day === "friday") return makeDay(false, null, null);
        if (day === "saturday") return makeDay(true, "09:00", "18:00");
        return makeDay(true, "10:00", "22:00");
      }),
  },
  {
    id: "late-night",
    label: "دوام متأخر",
    description: "16:00 حتى 02:00 من اليوم التالي — يتخطى منتصف الليل",
    build: () => buildWorkingHours(() => makeDay(true, "16:00", "02:00")),
  },
  {
    id: "split-weekend",
    label: "جمعة فقط متأخر",
    description: "السبت 14:00 – 02:00، الجمعة 12:00 – 02:00، والباقي 10:00 – 22:00",
    build: () =>
      buildWorkingHours((day) => {
        if (day === "friday") return makeDay(true, "12:00", "02:00");
        if (day === "saturday") return makeDay(true, "14:00", "02:00");
        return makeDay(true, "10:00", "22:00");
      }),
  },
];
