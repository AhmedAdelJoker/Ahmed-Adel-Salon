/**
 * Working-hours helpers for the public site.
 *
 * A window whose close time is earlier than its open time crosses midnight
 * (22:00 → 03:00). Naive `now >= open && now <= close` reports "closed" for the
 * small hours, which is exactly when a late salon is busiest.
 */

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

export type WorkingHourEntry = {
  is_open?: boolean;
  open_time?: string | null;
  close_time?: string | null;
};

export type WorkingHours = Record<string, WorkingHourEntry | undefined>;

const JS_DAY_TO_KEY: Record<number, DayKey> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export const parseMinutes = (value?: string | null): number | null => {
  if (typeof value !== "string") return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const crossesMidnight = (entry?: WorkingHourEntry): boolean => {
  if (!entry?.is_open) return false;
  const open = parseMinutes(entry.open_time);
  const close = parseMinutes(entry.close_time);
  if (open === null || close === null) return false;
  return close <= open;
};

/** "22:00 – 03:00 (+1)" for an overnight window, plain range otherwise. */
export const formatHoursRange = (entry?: WorkingHourEntry): string => {
  if (!entry?.is_open || !entry.open_time || !entry.close_time) return "مغلق";
  return crossesMidnight(entry)
    ? `${entry.open_time} – ${entry.close_time} (+1)`
    : `${entry.open_time} – ${entry.close_time}`;
};

/** Zone-aware "what day and time is it at the salon" for the browser clock. */
export const salonClock = (
  timezoneOffsetMinutes = 180,
  now: Date = new Date(),
): { dayKey: DayKey; minutes: number; time: Date } => {
  const shifted = new Date(now.getTime() + (now.getTimezoneOffset() + timezoneOffsetMinutes) * 60000);
  return {
    dayKey: JS_DAY_TO_KEY[shifted.getDay()],
    minutes: shifted.getHours() * 60 + shifted.getMinutes(),
    time: shifted,
  };
};

export const isOpenAt = (
  hours: WorkingHours | undefined,
  minutes: number,
  dayKey: DayKey,
  previousDayKey: DayKey,
): boolean => {
  const today = hours?.[dayKey];
  if (today?.is_open) {
    const open = parseMinutes(today.open_time);
    const close = parseMinutes(today.close_time);
    if (open !== null && close !== null) {
      if (open < close) return minutes >= open && minutes <= close;
      return minutes >= open || minutes <= close; // crosses midnight
    }
    return true;
  }

  // A window that opened yesterday and runs past midnight still counts.
  const previous = hours?.[previousDayKey];
  if (previous?.is_open && crossesMidnight(previous)) {
    const close = parseMinutes(previous.close_time);
    const open = parseMinutes(previous.open_time);
    if (open !== null && close !== null) return minutes <= close;
  }
  return false;
};

export const isOpenNow = (
  hours: WorkingHours | undefined,
  timezoneOffsetMinutes = 180,
): boolean => {
  const { dayKey, minutes } = salonClock(timezoneOffsetMinutes);
  const previousIndex = (WORKING_HOURS_DAYS.indexOf(dayKey) + 6) % 7;
  return isOpenAt(hours, minutes, dayKey, WORKING_HOURS_DAYS[previousIndex]);
};
