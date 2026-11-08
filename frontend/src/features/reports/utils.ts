export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function firstDayOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function shiftDaysKey(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type ReportPreset = "today" | "week" | "month" | "custom";

export function presetRange(preset: Exclude<ReportPreset, "custom">): { from: string; to: string } {
  const to = todayKey();
  if (preset === "today") return { from: to, to };
  if (preset === "week") return { from: shiftDaysKey(-6), to };
  return { from: firstDayOfMonth(), to };
}

export const PRESET_OPTIONS: { value: ReportPreset; key: string }[] = [
  { value: "today", key: "empReports.presetToday" },
  { value: "week", key: "empReports.presetWeek" },
  { value: "month", key: "empReports.presetMonth" },
  { value: "custom", key: "empReports.custom" },
];
