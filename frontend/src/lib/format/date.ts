// ═══════════════════════════════════════════════════════════════
// DATE & TIME UTILITIES — Using dayjs for Accuracy
// ═══════════════════════════════════════════════════════════════

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isBetween from "dayjs/plugin/isBetween";

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);

// Default timezone for the salon
const DEFAULT_TIMEZONE = "Africa/Cairo";

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function getToday() {
  return dayjs().tz(DEFAULT_TIMEZONE).format("YYYY-MM-DD");
}

/**
 * Format a Date/string to YYYY-MM-DD string.
 */
export function formatDateISO(date: unknown): string {
  if (!date) return getToday();
  return dayjs(date as string | number | Date).tz(DEFAULT_TIMEZONE).format("YYYY-MM-DD");
}

/**
 * Parse a YYYY-MM-DD string to a dayjs object.
 */
export function parseDateISO(value) {
  if (!value) return dayjs().tz(DEFAULT_TIMEZONE);
  return dayjs(value, "YYYY-MM-DD").tz(DEFAULT_TIMEZONE);
}

/**
 * Add days to a date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} YYYY-MM-DD
 */
export function addDays(dateStr, days) {
  return dayjs(dateStr)
    .tz(DEFAULT_TIMEZONE)
    .add(days, "day")
    .format("YYYY-MM-DD");
}

/**
 * Format time from 24h HH:MM to 12h format with AM/PM in Arabic.
 * @param {string} time24 - HH:MM (24-hour format)
 * @returns {string} e.g., "10:30 ص"
 */
export function formatTime12h(time24) {
  if (!time24) return "";
  const time = String(time24).slice(0, 5);
  return dayjs(time, "HH:mm")
    .format("hh:mm A")
    .replace("AM", "ص")
    .replace("PM", "م");
}

/**
 * Format time from HH:MM to display label like "10:30 ص".
 */
export function formatTimeLabel(date) {
  if (!date) return "";
  return dayjs(date).format("hh:mm A").replace("AM", "ص").replace("PM", "م");
}

/**
 * Parse a time string to a dayjs object for calculations.
 * @param {string} timeStr - Time string (HH:MM or "10:30 ص")
 * @returns {dayjs}
 */
export function parseTime(timeStr) {
  if (!timeStr) return dayjs();

  // Handle Arabic AM/PM
  if (timeStr.includes("ص") || timeStr.includes("م")) {
    const cleanTime = timeStr.replace("ص", "").replace("م", "").trim();
    const isPM = timeStr.includes("م");
    const parsed = dayjs(cleanTime, "hh:mm");
    if (isPM && parsed.hour() < 12) {
      return parsed.add(12, "hour");
    }
    if (!isPM && parsed.hour() === 12) {
      return parsed.hour(0);
    }
    return parsed;
  }

  return dayjs(timeStr, "HH:mm");
}

/**
 * Calculate expected end time from start time and duration.
 * @param {string} startTime - HH:MM format
 * @param {number} durationMinutes
 * @returns {string|null} HH:MM format or null
 */
export function calculateEndTime(startTime, durationMinutes) {
  if (!startTime || !durationMinutes) return null;
  try {
    const start = dayjs(startTime.slice(0, 5), "HH:mm");
    const end = start.add(durationMinutes, "minute");
    return end.format("HH:mm");
  } catch (err) {
    return null;
  }
}

/**
 * Get the difference in minutes between two times.
 * @param {string} startTime - HH:MM
 * @param {string} endTime - HH:MM
 * @returns {number} Difference in minutes
 */
export function getTimeDiffMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const start = dayjs(startTime.slice(0, 5), "HH:mm");
  const end = dayjs(endTime.slice(0, 5), "HH:mm");
  return end.diff(start, "minute");
}

/**
 * Check if a time string is in the past relative to now.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 * @param {number} bufferMinutes - Buffer in minutes (default 0)
 * @returns {boolean}
 */
export function isTimePast(dateStr, timeStr, bufferMinutes = 0) {
  if (!dateStr || !timeStr) return false;
  const target = dayjs(
    `${dateStr} ${timeStr.slice(0, 5)}`,
    "YYYY-MM-DD HH:mm",
  ).tz(DEFAULT_TIMEZONE);
  const now = dayjs().tz(DEFAULT_TIMEZONE).subtract(bufferMinutes, "minute");
  return target.isBefore(now);
}

/**
 * Check if a date is today.
 */
export function isToday(dateStr) {
  return dayjs(dateStr).isSame(dayjs(), "day");
}

/**
 * Check if a date is tomorrow.
 */
export function isTomorrow(dateStr) {
  return dayjs(dateStr).isSame(dayjs().add(1, "day"), "day");
}

/**
 * Check if a date is within the next N days.
 */
export function isWithinDays(dateStr, days) {
  const target = dayjs(dateStr);
  const now = dayjs();
  const diff = target.diff(now, "day");
  return diff >= 0 && diff <= days;
}

/**
 * Get relative date label in Arabic.
 */
export function getRelativeDateLabel(dateStr) {
  if (isToday(dateStr)) return "اليوم";
  if (isTomorrow(dateStr)) return "غداً";
  if (isWithinDays(dateStr, 2)) return "بعد غد";
  if (isWithinDays(dateStr, 7)) return "هذا الأسبوع";
  return dateStr;
}

/**
 * Format a full date+time for display.
 */
export function formatDateTime(dateStr, timeStr) {
  return `${dateStr} ${formatTime12h(timeStr)}`;
}

/**
 * Build time slots for a given range.
 * @param {number} startHour - Start hour (default 9)
 * @param {number} endHour - End hour (default 22)
 * @param {number} stepMinutes - Step in minutes (default 30)
 * @returns {string[]} Array of time labels
 */
export function buildTimeSlots(startHour = 9, endHour = 22, stepMinutes = 30): string[] {
  const slots: string[] = [];
  let current = dayjs().hour(startHour).minute(0).second(0);
  const end = dayjs().hour(endHour).minute(0).second(0);

  while (current.isBefore(end) || current.isSame(end)) {
    slots.push(current.format("hh:mm A").replace("AM", "ص").replace("PM", "م"));
    current = current.add(stepMinutes, "minute");
  }
  return slots;
}

/**
 * Check if two time ranges overlap.
 * @param {string} start1 - Start time HH:MM
 * @param {string} end1 - End time HH:MM
 * @param {string} start2 - Start time HH:MM
 * @param {string} end2 - End time HH:MM
 * @returns {boolean}
 */
export function doTimeRangesOverlap(start1, end1, start2, end2) {
  const s1 = dayjs(start1, "HH:mm");
  const e1 = dayjs(end1, "HH:mm");
  const s2 = dayjs(start2, "HH:mm");
  const e2 = dayjs(end2, "HH:mm");
  return s1.isBefore(e2) && s2.isBefore(e1);
}

// Re-export dayjs for advanced usage
export { dayjs };
